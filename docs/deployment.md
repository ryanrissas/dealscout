# Deployment

## Docker (simplest)

```bash
docker compose up --build
```

Services: `db` (Postgres 16 + volume), `app` (pushes schema, seeds idempotently,
serves on :3000), `worker` (cron ingestion, default every 30 min).
Change `NEXTAUTH_SECRET` and `CRON_SECRET` before exposing anything.

## Bare metal / VM

```bash
npm ci && npx prisma generate
npx prisma db push        # or prisma migrate deploy with committed migrations
npm run db:seed           # optional demo data
npm run build && npm run start
npm run worker            # separate process (systemd unit / pm2)
```

## Scheduled ingestion without the worker

Any scheduler can hit the ingestion endpoint:

```bash
curl -X POST "$APP_URL/api/jobs/ingest" -H "Authorization: Bearer $CRON_SECRET"
```

## Production checklist

- [ ] Strong `NEXTAUTH_SECRET` (`openssl rand -hex 32`) and `CRON_SECRET`
- [ ] `DEALSCOUT_DISABLE_MOCKS=1` once a licensed feed is configured
- [ ] Real user accounts (replace seeded demo users; passwords are bcrypt-hashed)
- [ ] SMTP configured if you want alert email
- [ ] Move `public/uploads` to object storage (S3/GCS) for multi-instance deploys
- [ ] `prisma migrate` workflow instead of `db push` for schema changes
- [ ] HTTPS termination in front of the app (the auth cookie should be secure)

## Notes

- Prisma is generated with the WASM query compiler (`engineType = "client"` +
  driver adapter for `pg`), so no native engine binaries are downloaded at
  build time — convenient for locked-down build environments.
- The map view fetches OpenStreetMap tiles client-side and needs internet.
