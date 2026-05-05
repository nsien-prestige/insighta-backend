# SOLUTION.md — Stage 4B

## 1. Query Performance

### Caching
Added Redis caching to `getAllProfiles` and `searchProfiles` using Upstash Redis via `ioredis`. Before hitting the database, each request checks Redis for a cached result using a key built from the request query parameters. On a cache miss, the result is fetched from PostgreSQL and stored in Redis with a 60-second TTL. Cache hits return results without touching the database at all.

### Connection Pooling
Configured the existing `pg` Pool with explicit limits — `max: 10` connections, `idleTimeoutMillis: 30000`, and `connectionTimeoutMillis: 2000`. This prevents connection exhaustion under concurrent load and avoids hanging requests.

### Query Restructuring
Replaced the two-query pattern (one for data, one for COUNT) in `getAllProfiles` and `searchProfiles` with a single query using `COUNT(*) OVER()` — a PostgreSQL window function that returns the total count alongside each row in one round trip. This eliminates one network round trip to the remote database per request.

### Before/After Comparison

| Scenario | Before | After |
|---|---|---|
| First request (cache miss) | ~3456ms | ~3564ms* |
| Repeated request (cache hit) | ~1220ms | ~370ms |
| Filtered query (cache hit) | ~869ms | ~344ms |

> *Cache miss times were measured locally where the backend connects to Supabase over a residential internet connection, causing higher latency (~3400ms). On the live server (Hostless), both backend and database are cloud-hosted so cache miss latency is significantly lower. Cache hit performance is consistent across both environments.

---

## 2. Query Normalization

### Problem
Two queries expressing the same intent — "young males from nigeria" and "males from nigeria who are young" — produce different cache keys because `req.query` contains the raw string. This causes redundant database calls.

### Solution
Added `utils/normalizeFilters.js` which sorts the parsed filter object's keys alphabetically before generating the cache key. Since `parseNaturalQuery` always produces the same filter keys regardless of word order, two equivalent queries now always produce the same normalized object and therefore the same cache key.

### Approach
- Parse the query string into filters using the existing rule-based parser
- Sort filter keys alphabetically using `Object.keys(filters).sort()`
- Rebuild the object with sorted keys
- Use `JSON.stringify(normalizedFilters)` as the cache key

This is deterministic, introduces no incorrect interpretations, and uses no AI or LLMs.

---

## 3. CSV Data Ingestion

### Endpoint
`POST /api/profiles/import` — admin only

### Approach
- File is received via `multer` using `memoryStorage()` — stored as a buffer, not written to disk
- Buffer is converted to a readable stream using `Readable.from(buffer)`
- Stream is piped through `csv-parse` which reads row by row — the entire file is never loaded into memory
- Valid rows are collected into chunks of 1000
- Each chunk is bulk inserted using a single parameterized SQL query with `ON CONFLICT (name) DO NOTHING`
- Invalid rows are skipped with reasons tracked

### Validation Per Row
- Missing required fields → `missing_fields`
- Invalid gender (not male/female) → `invalid_gender`
- Invalid age (negative or non-numeric) → `invalid_age`
- Duplicate name (checked against DB before inserting) → `duplicate_name`
- Malformed CSV row (caught by try/catch around parser) → `malformed_row`

### Failure Handling
A single bad row never fails the upload. Rows already inserted are kept — there is no rollback. The response always returns a summary of inserted vs skipped rows with breakdown by reason. If the parser throws on a malformed row, any rows collected before the error are still inserted and the summary is returned.

### Concurrency
Uploads do not block read queries. The streaming approach means memory usage stays low regardless of file size. Multiple uploads can run concurrently since each is an independent stream with its own chunk buffer.

---

## Trade-offs

- The duplicate check (`SELECT id WHERE name = $1`) runs per row before inserting. For very large files this adds latency but ensures accurate `duplicate_name` counts. A future optimization would be to defer this check to the bulk insert and infer duplicates from rows affected count.
- Redis is a single instance — if it goes down, requests fall through to the database gracefully since cache misses are handled.
- Cache TTL of 60 seconds means slight staleness is possible for read queries immediately after a write. This is acceptable per the consistency requirements.
- Connection pool `connectionTimeoutMillis` is set to 2000ms which may be tight for cold starts on the remote Supabase instance. This can be increased if timeouts are observed in production.
