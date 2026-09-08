# Security update

## Implemented

- Authentication remains Supabase Bearer JWT, validated server-side with active-account and database role checks. Inactive accounts cannot log in.
- Redis-backed rate limits in production. IP: 6000/minute overall, 120/15 minutes for authentication, 120/minute guest requests. Account: 10/15 minutes for authentication. Authenticated user: 240/minute and 30 photo uploads/minute. Tune using realistic load tests before 1000-user rollout. Redis failure denies limited requests instead of disabling enforcement.
- JSON limit 256 KiB; prototype keys, deep nesting and invalid authentication types rejected. Workflow validates known fields, money, item quantities, photo namespace and step advancement on server. Version mismatch returns 409 to avoid stale overwrites.
- CSRF defence for Bearer-token architecture: all API mutations require X-FotoSnaps-Request: 1. CORS permits only configured exact origins, no credentialed cookie authentication. The frontend sends the header on JSON and multipart requests. If cookie authentication is introduced, reassess CSRF protection.
- JPEG/PNG/WebP content inspection, decoded-pixel limit, single-image restriction, re-encoding and multipart limits.
- Legacy generic CRUD writes, raw correction writes and legacy admin workflow writes disabled. Legacy lists restricted to Super Admin and capped at 500. Current frontend uses dedicated workspace APIs. External integrations using those legacy APIs must migrate.
- HTTPS required in production. Trust only configured proxy addresses. Requests to dotfiles, SQL/backups/logs/maps denied at API boundary. Helmet and no-store applied. Caddy template handles frontend headers, automatic certificates and HTTP redirects after DNS is configured.
- Production startup rejects missing origins, server credentials, Redis and development OTP mode. Root ignore files, secret scanner and CI gates included. No secrets should be supplied via VITE_ variables.
- Error logs use request IDs without body/token contents. Authenticated mutations emit structured status logs. Existing database audit records remain in dedicated business operations.
- TDD regression tests written and observed failing before HTTP, legacy-access, file-content and workflow validation fixes.

## Required deployment setup (not activated remotely)

1. Install backend dependencies with npm ci. Use NODE_ENV=production. Configure exact HTTPS CORS_ORIGIN, Supabase and storage credentials, REDIS_URL. Keep Redis private with authentication and TLS when remote. Multiple instances must share Redis. Do not set trust proxy to true. With local Caddy use TRUST_PROXY_CIDRS=loopback and HOST=127.0.0.1.
2. Set VITE_API_BASE_URL to the HTTPS API origin before frontend build. Deploy only frontend/dist as static files. Do not serve the repository or Vite dev server. Keep Google browser keys domain/API restricted.
3. Set APP_DOMAIN and API_DOMAIN for deployment/Caddyfile. Point DNS to the server and permit certificate issuance on ports 80/443. Validate the template using caddy validate, then test camera/GPS and photo/PDF loading on the real domain. Adjust CSP connect-src only for the exact storage endpoint if using non-Supabase S3.
4. Protect Git branches and require CI. Run scripts/check-secrets.py. This is a basic current-file scan, not proof that historical secrets never leaked. Run a dedicated Git-history secret scan before first publication and rotate any exposed credentials. The delivered source has no Git history to audit.
5. Configure automated managed database backups/PITR and separately back up private photo storage. scripts/backup-database.py creates a restricted PostgreSQL dump using PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE environment variables; it validates archive readability only. Schedule it securely if used, encrypt off-site copies and test a restore in an isolated database. Never point a restore test at production. Configure retention and measure recovery time.
6. Route JSON logs and /health into your monitoring service. Alert on sustained 5xx, Redis failure, abnormal 401/403/429 volume and backup failures. Set log access/retention and alerts in hosting; none have been provisioned remotely.
7. Run npm test in backend, frontend tests/build, dependency audit, and staged load testing. CI is included under .github/workflows/security.yml and activates once pushed to GitHub.

## Limits and remaining release gates

This update is not a certification for 1000 employees. Test Redis across multiple instances, device GPS/camera, real storage, production TLS and backup restoration before rollout. Existing test suites skip database integration tests without an isolated database. No live database, DNS, hosting, backup schedule or alerting service was changed.

Fine-grained manager access by branch/store still needs an explicit assignment model and audit of all dedicated manager endpoints. The existing manager roles have broad administrative access in several operations. Do not assume branch isolation merely because role guards exist. Guest attendance remains intentionally public and requires administrative review. Camera-only UI does not cryptographically prove that an API client captured a live image. Application audit logs are not tamper-proof compliance storage.

Sources consulted: https://expressjs.com/en/advanced/best-practice-security/ and https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html

## Verification results

On this update: 29 backend tests passed, 3 database integration tests skipped; 23 frontend tests passed; TypeScript and production build passed. npm audit --omit=dev reported zero known advisories for both backend and frontend after pinning the patched qs dependency. The basic secret/config scan passed. These results do not cover live TLS, multi-instance Redis, production DB policy advisors, or backup restore execution.
