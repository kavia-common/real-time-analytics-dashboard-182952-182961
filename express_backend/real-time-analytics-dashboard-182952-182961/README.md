# real-time-analytics-dashboard-182952-182961

Backend (Express + MongoDB + Socket.io) quick start

Environment variables:
- MONGODB_URI: Mongo connection string (required)
- FRONTEND_ORIGIN: CORS allowed origin for frontend (default http://localhost:3000)
- PORT: Backend port (default 3001)
- HOST: Bind host (default 0.0.0.0)

Run:
1. cd express_backend
2. npm install
3. npm run dev

API:
- GET /api/events -> last 10 events sorted by timestamp desc
- POST /api/events -> { username, event_type, timestamp? } returns 201 with created doc and emits 'new_event' via Socket.io

WebSocket:
- Socket.io served from the backend origin, event name: 'new_event'

Docs:
- /docs for Swagger UI
