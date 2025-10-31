# real-time-analytics-dashboard-182952-182961

Backend (Express + MongoDB + Socket.io) quick start

Environment variables:
- MONGODB_URI: Mongo connection string (required)
- FRONTEND_ORIGIN: CORS allowed origin for frontend (default http://localhost:3000)
- STRICT_CORS: When true, only allow known local origins; otherwise dev-friendly (default false)
- PORT: Backend port (default 3001)
- HOST: Bind host (default 0.0.0.0)
- JWT_SECRET: Secret used to sign/verify JWTs (REQUIRED for auth)
- TOKEN_EXPIRES_IN: JWT expiration (default "1d")

See .env.example for a full template.

Run:
1. cd express_backend
2. npm install
3. Copy .env.example to .env and configure values
4. npm run dev

Auth:
- POST /api/auth/signup -> Create user {username, email, password} returns { user, token }
- POST /api/auth/login -> Login {email, password} returns { user, token }
- GET /api/auth/me -> Get current user (requires Authorization: Bearer <token>)

Admin Auth (separate collection and JWT role=admin):
- POST /api/admin/auth/signup -> Create admin {username, email, password} returns { admin, token }
- POST /api/admin/auth/login -> Login admin {email, password} returns { admin, token }
- GET /api/admin/auth/me -> Get current admin (requires Authorization: Bearer <token>)

API:
- GET /api/events -> last 10 events sorted by timestamp desc
- POST /api/events -> { username, event_type, timestamp? } returns 201 and emits 'new_event'
- POST /api/questions -> Create MCQ (requires auth + admin role)
- GET /api/questions -> List questions (public)
- POST /api/answers -> Submit answer (requires auth)
- Metrics under /api/metrics/... -> public by default (no auth)

WebSocket:
- Socket.io served from the backend origin, event name(s): 'new_event', 'new_answer', 'metrics_update', 'user_event_created'

CORS:
- The server allows Authorization headers and credentials.
- FRONTEND_ORIGIN is used for Socket.io and CORS.
- In STRICT_CORS mode, only explicit origins are allowed.

Docs:
- /docs for Swagger UI
