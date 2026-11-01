# Verification record

## Design

The original landing implementation and authentication stylesheet/layout are protected by SHA-256 checks in `frontend/e2e/phase1.spec.ts` against `landing-preservation.json`. Workspace styles are scoped under `.quantara-app`. Landing screenshots and actual browser computed fonts verify DM Serif Display headings and Inter body text.

## Automated checks

- Maven package: 11 tests, 10 passed, one optional environment-dependent database test skipped. Authentication/session/CSRF, actual DuckDB isolation, rejected SQL, and rate-limit behavior are covered.
- Python: three tests passed. They cover real forecast bounds, anomaly detection, temporal evaluation, missing actuals, token authentication, and invalid inputs.
- Frontend production build and lint complete. Lint currently reports advisory React purity/refresh/effect warnings, including existing landing/auth code. The production build reports a large initial bundle advisory; neither check reports a compilation error.
- Playwright: all seven local acceptance scenarios passed. Six passed in the complete run; the final CORS assertion was corrected to target Spring Boot directly instead of Vite's preflight handler, then the complete seventh scenario passed. Tests exercise real Neon registration/login, dataset isolation, CSV/XLSX uploads, SQL, streaming Ollama, ML, dashboards, filters, reports, profile preferences, onboarding, search, and notifications.

Screenshots live in `frontend/artifacts`. No test credentials are checked into source. Browser tests create uniquely named test accounts and preserve pre-existing data.

## Deployment

Actual service IDs, URLs, Free-plan confirmation, deploy state, and live endpoint checks belong in `deployment-status.md`. A successful build is not proof of a successful deployment. Cloud Ollama and free hosting limitations are explained in `deployment.md`.
