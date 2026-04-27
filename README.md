# Intelligence Query Engine

A queryable demographic intelligence API built with Node.js, Express, and PostgreSQL.

## Base URL
```
https://hng-stage-2.hostless.app
```

## Setup

```bash
npm install
```

Create a `.env` file:
```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=yourpassword
DB_NAME=hng_stage2
DATABASE_URL=your_production_url
```

Run schema, seed, and start:
```bash
node db/seed.js
npm start
```

## Endpoints

### GET /api/profiles
Returns paginated profiles with optional filters and sorting.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| gender | string | male or female |
| age_group | string | child, teenager, adult, senior |
| country_id | string | ISO code e.g. NG |
| min_age | number | Minimum age |
| max_age | number | Maximum age |
| min_gender_probability | number | Minimum gender confidence |
| min_country_probability | number | Minimum country confidence |
| sort_by | string | age, created_at, gender_probability |
| order | string | asc or desc |
| page | number | Page number (default: 1) |
| limit | number | Results per page (default: 10, max: 50) |

**Example:**
```
GET /api/profiles?gender=male&country_id=NG&min_age=25&sort_by=age&order=desc
```

**Response:**
```json
{
  "status": "success",
  "page": 1,
  "limit": 10,
  "total": 60,
  "data": [...]
}
```

### GET /api/profiles/search
Natural language query endpoint.

**Query Parameters:**
| Param | Description |
|-------|-------------|
| q | Natural language query string |
| page | Page number (default: 1) |
| limit | Results per page (default: 10, max: 50) |

**Example:**
```
GET /api/profiles/search?q=young males from nigeria
```

**Supported Query Patterns:**
- Gender: "males", "females", "male and female"
- Age groups: "young" (16-24), "adult", "teenager", "child", "senior"
- Country: "from nigeria", "from kenya"
- Age range: "above 30", "below 20"

**Response:**
```json
{
  "status": "success",
  "page": 1,
  "limit": 10,
  "total": 25,
  "data": [...]
}
```

## Error Responses

```json
{ "status": "error", "message": "<error message>" }
```

| Status | Meaning |
|--------|---------|
| 400 | Missing or invalid parameters |
| 422 | Invalid parameter type |
| 404 | Profile not found |
| 500 | Server error |

## Natural Language Parsing

Rule-based parsing only — no AI or LLMs used. The parser detects keywords from the query string and maps them to database filters.

## Database

PostgreSQL with the following indexes for performance:
- `idx_gender` on gender
- `idx_age_group` on age_group  
- `idx_country_id` on country_id
- `idx_age` on age