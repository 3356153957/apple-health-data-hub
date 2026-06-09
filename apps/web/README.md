# @hdh/web - Apple Health Coach Dashboard

The standalone, insight-first web dashboard for Health Data Hub. It reads the
same v2 API used by the analysis layer and turns Apple Watch / iPhone records
into a daily health coach experience.

## What This Web App Is For

This is for people who self-host their Apple Health data and want more than a
raw table of metrics.

- Today coach: what to do first today.
- Daily summary: yesterday's movement and sleep, with practical advice.
- Alerts: health signals that need attention, with links to supporting data.
- Metric details: weekly and monthly context, not only one-line summaries.
- Sources and sync: check whether Apple Watch, iPhone, and the backend are
  sending fresh data.

The UI is Chinese-first today, but the API and data model are not tied to
Chinese.

## Run

```bash
cd apps/web
npm install
```

Create `apps/web/.env.local` locally:

```env
API_BASE=http://localhost:8000
API_KEY=your-local-api-key
HEALTH_WEB_PASSWORD=choose-a-local-dashboard-password
```

Then run:

```bash
npm run dev
```

Point `API_BASE` at a running Health Data Hub API. Server components fetch it
directly; the `/api/*` rewrite in `next.config.mjs` covers client-side fetches.

Open:

```text
http://127.0.0.1:5173/unlock
```

After entering the local dashboard password, the main coach page is:

```text
http://127.0.0.1:5173/apple/coach
```

On Windows, the default dev port is `5173` because some machines reserve the old
`4173` range.

## Privacy Notes

- Never commit `.env.local`.
- `API_KEY` is used by the Next.js server and is not sent to the browser.
- `HEALTH_WEB_PASSWORD` protects health pages on a trusted LAN.
- The real dashboard password must stay local. Do not write it into source code
  or README files.
- Health data, logs, screenshots containing personal data, and database dumps
  should stay outside Git.
- The password gate is a local access-control layer. Use TLS, a reverse proxy,
  and stronger deployment controls before exposing this app outside your LAN.

## Status

Pre-release. The dashboard is in active development and is not part of the
default `docker compose` stack yet. Run it manually during development.

Already included:

- Chinese Apple Health coach flow.
- Apple Health overview, browse, metric detail, daily summary, alerts, goals,
  reports, sources, and sync pages.
- Empty/no-data and backend-unreachable states.
- Local password gate for LAN use.
- Product-level visual polish for desktop and mobile layouts.

CI currently verifies the TypeScript build/typecheck level. Full visual
verification requires the API, TimescaleDB, and ingested sample data.
