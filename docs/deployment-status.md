# Live deployment verification

Verified on November 1, 2026.

| Component | Address | Result |
| --- | --- | --- |
| Public website | https://quantara-neon.vercel.app | HTTP 200, Vercel production |
| Spring Boot backend | https://quantara-api-dt51.onrender.com | Render **Free**, My Workspace |
| Backend health | https://quantara-api-dt51.onrender.com/actuator/health | HTTP 200, `UP` |
| Frontend-to-backend CSRF | https://quantara-neon.vercel.app/api/auth/csrf | HTTP 200, cookie set on frontend origin |
| Statistical service | https://quantara-ml.onrender.com/health | HTTP 200, `UP`, Render **Free** |
| Source | https://github.com/rutvilandge/Quantara | Implementation, MIT license, README, .gitignore committed |

Render workspace: **My Workspace** (`tea-dacr5tn40ujc739uap1g`). API service `srv-dbjgkgk9v7es73a1v88g`; ML service `srv-dbjgki142hec73cvbfkg`. Both use the `free` instance plan. No paid instances, disks, databases, workers, or card requests were created.

The frontend API rewrite targets the actual Render backend. The backend CORS allowlist contains the exact public website origin. Secure HttpOnly session cookies remain on the frontend origin through the proxy. CSRF protection is enabled. Production signup returned 201 and login returned 200; a browser check verified session persistence after reload, upload, and a saved dashboard. Authenticated cloud ML analysis returned 200 with seven forecast points and a real RMSE evaluation metric.

The full production browser acceptance test passed in 32.5 seconds, including signup, login, secure cookie checks, reload, a 750-row demo, real SQL aggregation, CSV upload, saved chart dashboard, authenticated Java-to-Python forecast, and logout.

The initial API deployment failed because environment variables were not yet configured. This was corrected by securely setting the separate datasource variables and deploying again. The later successful deployment also activated the final Vercel origin, resolving signup's temporary security-verification error.

Free services sleep and can need time to wake. A first ML readiness check can fail while a subsequent analysis succeeds. The UI provides a connection retry and never fabricates predictions. Both services share the workspace's free instance-hour allowance.

**Ollama is verified locally, not hosted by the Free Render services.** The production Copilot reports the model unavailable until a secure reachable model host is configured. Local Qwen2.5-Coder streaming and SQL execution passed the real-model browser check. See [zero-cost model and ML fallback](deployment.md). Do not treat a remote `127.0.0.1` as the user's computer or claim production AI readiness.

Render auto-deploy is currently disabled; deploy backend/ML changes explicitly with the CLI or Render Dashboard. Vercel is connected to the GitHub repository with root directory `frontend`; pushes can trigger frontend builds. Keep secrets in the hosting platform's environment settings.
