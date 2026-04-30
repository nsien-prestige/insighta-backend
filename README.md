# Insighta Labs+ Backend

A secure, multi-interface demographic intelligence platform built with Node.js, Express, and PostgreSQL.

## Live URLs

- **Backend API:** https://insightabackend.hostless.app
- **Web Portal:** https://insightalabs.netlify.app

## System Architecture

Three repositories, one backend. The CLI and web portal both talk to the same backend API.

```
Web Portal (Netlify) ──┐
CLI (Local)          ──┼──► Backend API (Hostless) ──► PostgreSQL (Supabase)
Direct API Access    ──┘
```

The backend is structured in layers:
- **Routes** handle incoming requests and apply middleware
- **Middleware** handles authentication, role checks, API versioning, and rate limiting in order
- **Controllers** contain the business logic
- **Database** stores profiles, users, and refresh tokens

## Authentication Flow

### Web Portal
1. User clicks "Continue with GitHub"
2. Browser generates `state` and `code_challenge` using PKCE
3. Redirects to `/auth/github` which redirects to GitHub OAuth page
4. User authorizes on GitHub
5. GitHub redirects to `/auth/github/callback`
6. Backend exchanges code with GitHub, creates or updates user
7. Backend sets HTTP-only cookies (`access_token` + `refresh_token`)
8. Redirects to dashboard

### CLI
1. User runs `insighta login`
2. CLI generates `state`, `code_verifier`, and `code_challenge` using PKCE
3. CLI starts a local server on `localhost:9876`
4. CLI opens browser to GitHub OAuth page
5. User authorizes on GitHub
6. GitHub redirects to `localhost:9876/callback`
7. CLI captures the code and validates the state
8. CLI sends `POST /auth/cli/callback` with `{ code, code_verifier }`
9. Backend exchanges code with GitHub and issues tokens
10. CLI stores tokens at `~/.insighta/credentials.json`
11. Terminal prints: `Logged in as @username`

## Token Handling Approach

Two tokens are issued on every login:

- **Access Token** — expires in 3 minutes. Sent with every request to prove identity. Contains user id, username, and role in the payload.
- **Refresh Token** — expires in 5 minutes. Stored in the database. Used only to get a new token pair when the access token expires.

**Token Rotation:** Every time a refresh token is used, it is immediately deleted from the database and a brand new pair is issued. Each refresh token can only be used once.

**Token Invalidation:** On logout, the refresh token is deleted from the database server-side. Even if someone has the token string, it is rejected because it no longer exists in the database.

**Web portal** tokens are stored in HTTP-only cookies — JavaScript cannot read them. **CLI** tokens are stored in `~/.insighta/credentials.json`.

**Auto-refresh:** Both the CLI and web portal automatically attempt to refresh tokens on a 401 response before asking the user to log in again.

## Role Enforcement Logic

Two roles exist in the system:

- **admin** — full access: can list, search, get, create, and export profiles
- **analyst** — read-only: can list, search, get, and export profiles. Cannot create profiles.

All new users are assigned the `analyst` role by default on first login.

Role enforcement uses a structured middleware chain applied at the router level, not scattered across individual controllers:

```
Request → requireApiVersion → authenticate → apiLimiter → requireRole (admin only routes) → controller
```

The `authenticate` middleware verifies the JWT and attaches `req.user` to the request. The `requireRole` middleware then checks `req.user.role` against the allowed roles for that route.

If a user's `is_active` field is `false`, all requests return `403 Forbidden` regardless of role.

## Natural Language Parsing Approach

The search endpoint `GET /api/profiles/search?q=...` uses a rule-based parser with no AI or LLMs involved.

The parser lowercases and sanitizes the query, then scans for keywords and maps them to database filters.

**Gender detection:**
- "males" or "male" maps to `gender = male`
- "females" or "female" maps to `gender = female`
- "male and female" applies no gender filter

**Age group detection:**
- "child" or "children" maps to `age_group = child`
- "teenager" or "teenagers" maps to `age_group = teenager`
- "adult" or "adults" maps to `age_group = adult`
- "senior" or "seniors" maps to `age_group = senior`

**Age range detection:**
- "young" maps to `min_age = 16, max_age = 24`
- "above 30" or "over 30" maps to `min_age = 30`
- "below 20" or "under 20" maps to `max_age = 20`

**Country detection:**
Country names are matched against a hardcoded map of 30+ countries and converted to ISO codes. For example "nigeria" maps to NG, "kenya" maps to KE, "ghana" maps to GH.

**Example queries:**
- "young males from nigeria" → `gender=male, min_age=16, max_age=24, country_id=NG`
- "females above 30" → `gender=female, min_age=30`
- "adult males from kenya" → `gender=male, age_group=adult, country_id=KE`
- "seniors from egypt" → `age_group=senior, country_id=EG`

**Limitations:**
- Only supports countries in the hardcoded country map
- Cannot handle compound country queries like "from nigeria or kenya"
- Cannot handle age ranges like "between 20 and 30" directly
- "young" is a special keyword and not a stored age group
- Queries with no recognizable filters return a 422 error

## Setup & Installation

### Prerequisites
- Node.js 18+
- PostgreSQL database
- Two GitHub OAuth Apps (one for web, one for CLI)

### Installation

```bash
git clone https://github.com/nsien-prestige/insighta-backend.git
cd insighta-backend
npm install
```

### Environment Variables

Create a `.env` file using `.env.example` as reference:

```env
DATABASE_URL=your_postgresql_connection_string
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_jwt_refresh_secret
GITHUB_CLIENT_ID=web_oauth_app_client_id
GITHUB_CLIENT_SECRET=web_oauth_app_client_secret
GITHUB_CALLBACK_URL=http://localhost:5000/auth/github/callback
GITHUB_CLI_CLIENT_ID=cli_oauth_app_client_id
GITHUB_CLI_CLIENT_SECRET=cli_oauth_app_client_secret
GITHUB_CLI_CALLBACK_URL=http://localhost:9876/callback
CLIENT_URL=http://localhost:3000
NODE_ENV=development
PORT=5000
```

### Database Setup

```bash
psql -U postgres -d your_database -f db/schema.sql
node db/seed.js
```

### Running

```bash
npm run dev   # development
npm start     # production
```

## Endpoints

### Auth
- `GET /auth/github` — redirect to GitHub OAuth
- `GET /auth/github/callback` — web OAuth callback
- `POST /auth/cli/callback` — CLI OAuth callback
- `POST /auth/refresh` — refresh tokens
- `POST /auth/logout` — logout
- `GET /auth/me` — get current user

### Profiles (requires `X-API-Version: 1` header and authentication)
- `GET /api/profiles` — list profiles with filters, sorting, pagination
- `GET /api/profiles/search` — natural language search
- `GET /api/profiles/export` — download profiles as CSV
- `GET /api/profiles/:id` — get single profile
- `POST /api/profiles` — create profile (admin only)

## Error Responses

All errors follow this structure:

```json
{
  "status": "error",
  "message": "description of the error"
}
```