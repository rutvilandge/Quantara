# Deployment: Vercel + Render Free + Neon

The intended Render workspace is **My Workspace**. Use **Free** web service instances exclusively. Do not attach paid disks, workers, cron jobs, or a new managed database. Keep the existing Neon database.

## Services

| Component | Runtime | Configuration |
| --- | --- | --- |
| Frontend | Vercel Hobby, Vite static output | `frontend`, `npm run build`, output `dist` |
| Primary API | Render Free Docker | `backend/Dockerfile`, health `/actuator/health` |
| Statistical analytics | Render Free Docker | `ml-service/Dockerfile`, health `/health` |
| Persistence | Existing Neon PostgreSQL | Environment credentials; SSL required |
| Natural-language SQL | Ollama Qwen2.5-Coder | Local service or an explicitly configured secure model host |

`render.yaml` documents both services with explicit `plan: free`. The backend Docker image uses Java 21 and bounded JVM memory. Python uses one Uvicorn worker and single-threaded BLAS to reduce memory use. Local Docker validation requires Docker; deployment must still verify real container startup and memory behavior.

## Secrets

Set `DATABASE_URL` to the clean **JDBC** URL without embedded `user` or `password` query parameters. Set `DATABASE_USERNAME` and `DATABASE_PASSWORD` separately in Render. Flyway shares these datasource credentials. Never commit a password or paste secret values into deployment logs.

Generate a high-entropy `ML_SERVICE_TOKEN` and configure the same value in both services. Set the backend `ML_SERVICE_URL` to the statistical service's HTTPS URL. Free web services use public HTTPS with token authentication for service calls; the ML token is never part of the frontend build. The Python service has no browser CORS allowlist and rejects analysis without the shared secret.

Production backend variables:

```text
DATABASE_URL
DATABASE_USERNAME
DATABASE_PASSWORD
SESSION_COOKIE_SECURE=true
CORS_ALLOWED_ORIGINS=<exact deployed frontend origin>
ML_SERVICE_URL=<HTTPS ML service origin>
ML_SERVICE_TOKEN
OLLAMA_URL=<reachable model origin, if available>
OLLAMA_MODEL=qwen2.5-coder:3b
OLLAMA_API_TOKEN=<required for a remote model gateway>
```

Vercel must proxy `/api/:path*` to Render before the SPA fallback rewrite. Leave the frontend API base at `/api`. This keeps session and CSRF cookies on the frontend origin; do not switch to cross-site cookies unnecessarily. Verify signup, login, reload, CSRF-protected mutations, logout, and private dataset access on the actual production URL.

## ₹0 limitations and fallback

Render Free services spin down after inactivity and share the workspace's free instance-hour allowance. Two services consume that allowance concurrently while awake. Cold starts can make the first request time out. Do not create artificial keep-alive traffic or claim guaranteed availability. See [Render Free documentation](https://render.com/docs/free).

A 3B Ollama model is not a reliable fit for a 512 MB Free instance. Render cannot access Ollama running on a developer's `127.0.0.1`. The optional authenticated local bridge below connects Render to the existing Qwen model over HTTPS. SQL execution, uploads, dashboards, and reports work independently. Do not replace Qwen with fabricated answers or an undisclosed paid API. Remote model endpoints require HTTPS and `OLLAMA_API_TOKEN`.

### Optional local Qwen bridge

Keep Ollama running with `qwen2.5-coder:3b` installed. Install the official [cloudflared client](https://developers.cloudflare.com/tunnel/downloads/) and log into the official Render CLI. Then run from the repository root:

```powershell
.\ml-service\.venv\Scripts\python.exe -u scripts/connect-local-ollama.py --service-id YOUR_RENDER_API_SERVICE_ID --cloudflared PATH_TO_CLOUDFLARED_EXE
```

The supervisor starts a gateway bound only to `127.0.0.1:11435`, generates a random token in memory, verifies anonymous access is rejected, configures the backend's `OLLAMA_URL` and `OLLAMA_API_TOKEN` securely, and triggers a Render deployment. It exposes only model-list and chat routes for the selected Qwen model; model installation and unrelated Ollama APIs are unavailable. Neither the token nor chat content is written to logs or command arguments.

This is a temporary demo connection. Your computer, Ollama, and the supervisor must stay running. Stopping the supervisor ends the tunnel; restarting it creates a new hostname and token and updates Render again. [Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/) have no uptime guarantee and are intended for testing. They do not support SSE; the model bridge uses Ollama NDJSON, while Spring Boot emits its own browser-facing SSE stream. Verify actual streaming through the complete deployed path. A stable production model host requires a separately configured service or a named tunnel; this setup does not claim always-on cloud AI hosting.

If the separate Python Free service cannot fit memory, exhausts shared hours, or cannot be provisioned without payment, retain all ML code and use the documented local launcher or private Docker Compose deployment. Cloud statistical controls then report the unavailable service clearly, without fake forecasts. A securely hosted Python endpoint can be connected later by changing only `ML_SERVICE_URL` and the shared token. `compose.yaml` keeps Python private to Java and exposes only port 8080. This fallback costs ₹0 on existing hardware and requires that hardware to remain running.

No Free-plan cold-start, sleeping, shared-hour, or local-model constraint should be presented as an application implementation success. Record actual live endpoints and checks in `docs/deployment-status.md` after deployment.
