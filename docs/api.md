# API reference

All paths below are prefixed `/api`. Except `auth/csrf`, `auth/signup`, and `auth/login`, APIs require the authenticated session cookie. Mutation requests require the `headerName` and `token` obtained from `GET /api/auth/csrf`.

| API | Behavior |
| --- | --- |
| `GET /auth/csrf` | Initialize CSRF cookie and obtain request token |
| `POST /auth/signup` | `{fullName,email,password}` |
| `POST /auth/login` | `{email,password}`; rotates session identifier |
| `GET /auth/me` / `POST /auth/logout` | Current safe account DTO / invalidate session |
| `GET /datasets` / `POST /datasets` | List own datasets / multipart `file` CSV or XLSX |
| `POST /datasets/demo` | Idempotently add the only 750-row E-commerce demo |
| `GET /datasets/{id}` | Schema, completeness, duplicate counts, suggestions |
| `GET /datasets/{id}/rows` | Paginated search, sort, and column filtering |
| `PATCH /datasets/{id}` / `DELETE /datasets/{id}` | Rename / delete only an owned dataset |
| `POST /queries/run` | `{datasetId,sql}` plus optional date/category filters |
| `GET /queries` / `POST /queries` | List / save `{datasetId,name,sql}` |
| `GET /queries/history` | Own recent executions |
| `GET /copilot/status` | Actual Ollama/model readiness |
| `POST /copilot/ask` | `{datasetId,question,conversationId?}`; draft only |
| `POST /copilot/ask/stream` | Same request; SSE `token`, validated `draft`, or `error` |
| `POST /copilot/insights` | `{datasetId,sql}`; execute again, interpret computed results |
| `GET /analytics/status` | Statistical service readiness |
| `POST /analytics/analyze` | `{datasetId,dateColumn,metricColumn,horizon,frequency,aggregation}` |
| `GET/POST /dashboards` | List / create owned dashboards |
| `GET/PUT /dashboards/{id}` | Load / persist widgets and layout |
| `GET /workspace/overview` | Real workspace counts and activity |
| `GET /workspace/search?q=...` | Own datasets, saved queries, and dashboards |
| `GET /workspace/notifications` / `POST /workspace/notifications/read` | Recent activity notifications / mark seen |
| `PATCH /account/profile` | Update full name |
| `GET/PATCH /account/preferences` | Appearance and onboarding preferences |
| `GET /account/usage` | Actual dataset/query/AI/ML activity counts |

Responses use 400 for invalid input, 401 for unauthenticated sessions, 403 for rejected CSRF/CORS, 404 for absent or unowned resources, 413 for oversized uploads, 422 for unsuitable statistical data, 429 for capacity/rate limits, and 503 for unavailable dependent services. Errors never substitute forecasts or invented query results.
