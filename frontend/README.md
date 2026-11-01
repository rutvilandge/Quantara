# QUANTARA frontend

React, TypeScript, Vite, Tailwind CSS v4, and Recharts. The original landing and authentication design is preserved; workspace styles are scoped under `.quantara-app`.

Production: https://quantara-neon.vercel.app

Run `npm ci`, then `npm run dev`. Vite proxies `/api` to Spring Boot on port 8080. Build with `npm run build`; check with `npm run lint`.

Vercel uses `vercel.json` to proxy `/api` to Render and route page navigation to the SPA. The frontend does not contain database or ML credentials.

See the [project README](../README.md), [deployment guide](../docs/deployment.md), and [API reference](../docs/api.md).
