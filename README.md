# LiveTech SEO Dashboard

Single-file SPA (`index.html`) for the LiveTech SEO team. All application logic lives in one file. A Cloudflare Worker (`cloudflare-worker.js`) acts as an authenticated proxy between the frontend and external APIs.

---

## Architecture

```
index.html  (SPA, deployed via git push → Cloudflare Pages or static host)
    │
    └── Cloudflare Worker  (livetech-claude-proxy.lively-morning-b71a.workers.dev)
            ├── POST /              → Anthropic Claude API
            ├── GET|POST /clickup/* → ClickUp v2 read proxy
            ├── POST /clickup-write/* → ClickUp v2 write proxy
            ├── POST /bigquery      → Google BigQuery synchronous query
            ├── POST /gsc-inspect   → Google Search Console URL inspection
            ├── GET /make/*         → Make.com API v2 proxy (eu2.make.com)
            └── GET /make-debug     → Diagnostic endpoint (list data stores, teams, orgs)
```

---

## Key Constants (index.html)

| Constant | Value | Purpose |
|---|---|---|
| `CLAUDE_PROXY` | `https://livetech-claude-proxy.lively-morning-b71a.workers.dev` | Cloudflare Worker URL |
| `SUPABASE_URL` | in file | Supabase project URL |
| `SUPABASE_KEY` | in file | Supabase anon key |
| `SEO_MARKETING_TEAM` | `['Sarah','Charlie','Megan','Sabrina']` | Team members |
| `SEO_MARKETING_HEAD` | `'Sarah'` | Head of SEO (admin-equivalent) |
| `MAKE_CLIENTS_FALLBACK` | 13 hardcoded clients | Used if Make.com API fails |

Admin users: **Holly** and **Sarah** (SEO_MARKETING_HEAD). Both can log/delete time in team view.

---

## Cloudflare Worker Secrets

Set these in Cloudflare Workers → Settings → Variables → Secret:

| Secret | Purpose |
|---|---|
| `ANTHROPIC_KEY` | Anthropic Claude API key |
| `CLICKUP_KEY` | ClickUp personal API token |
| `MAKE_API_TOKEN` | Make.com API token (`Authorization: Token <value>`) |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Google service account email |
| `GOOGLE_PRIVATE_KEY` | Google service account private key (RSA PEM, `\n` escaped) |
| `GOOGLE_SA_JSON` | *(optional)* Full service account JSON — overrides the two above |

**Important**: Make.com account is on **eu2.make.com** (NOT eu1). The worker targets `https://eu2.make.com/api/v2/` for all Make requests. If you regenerate the Make.com API token, update `MAKE_API_TOKEN` in Cloudflare immediately.

---

## Make.com Data Stores

The app uses Make.com as the **master client list** (not Supabase).

| Data Store | ID | Name |
|---|---|---|
| Marketing Clients | `157873` | "Marketing Clients" — primary client list |
| SC URLs Sample Data | `160154` | Search Console sample URLs |

Team ID: `583475`

The frontend calls `GET /make-clients` on the Cloudflare Worker. The worker handles all pagination internally:
- Endpoint: `GET /data-stores/157873/data?teamId=583475&pg[offset]={n}` (Make.com v2)
- Make.com returns 10 records per page by default; `pg[limit]` values >10 return 400
- Worker loops with `pg[offset]` until a partial page signals the end
- Returns `{ records: [...] }` to the frontend in one response
- Falls back to `MAKE_CLIENTS_FALLBACK` (13 hardcoded) if the worker call fails

**Important endpoint notes (hard-won):**
- `/data-stores/{id}/data` ✅ correct path
- `/data-stores/{id}/data-store-records` ❌ returns 404
- `/data-store-records?dataStoreId={id}` ❌ returns 404
- `pg[limit]=500` ❌ returns 400 (Make.com rejects large limits)
- `pg[offset]=N` ✅ only way to paginate

Each client record has fields: `data['Client Name']`, `data['Assignee']` (email like `megan@livetech.co.uk`). No `bq_dataset` field — client `id` falls back to record `key` (hex string). Assignee is normalised to capitalised first name at load time. Holly and Unassigned are filtered out of the sidebar display.

---

## Supabase Tables

| Table | Purpose |
|---|---|
| `tasks` | Task items (title, assignee, status, due date, etc.) |
| `marketing_time` | Time log entries (user, client, date, minutes, task_id) |
| `sc_data` | Search Console cached data |
| `meeting_notes` | Meeting notes per client |
| `client_allocations` | *(planned)* Monthly time budgets per client |

---

## Views / Navigation

| View key | Description |
|---|---|
| `list` | Task list |
| `kanban` | Kanban board |
| `calendar` | Calendar (Tasks group) |
| `workload` | Workload view |
| `timesheets` | My time / team time logs |
| `marketing-review` | Client SEO data review (BigQuery + GSC) |
| `meeting-notes` | Meeting notes per client |

Sidebar structure:
- **Tasks** → List / Kanban / Calendar / Schedule (sub-items)
- **Timesheets** → My Time (sub-item)
- Marketing Review
- Meeting Notes

---

## Admin / Team View Logic

- `currentUser` — logged-in user (first name, e.g. `"Megan"`)
- `teamViewUser` — when an admin clicks a team member, this is set
- `isTeamView()` — returns `true` when admin is viewing as another user
- Admins (Holly, Sarah) can log and delete time even in team view
- Client dropdowns filter by `assignee` matching `currentUser` unless admin and not in team view

Pattern used throughout:
```javascript
const isAdmin = (currentUser === SEO_MARKETING_HEAD || currentUser === 'Holly') && !isTeamView();
```

---

## Google BigQuery / GSC

- BigQuery project: embedded in queries as `projectId` parameter
- GSC inspection: batched 5 URLs at a time, max 100 per call, 250ms between batches (2000/day quota)
- Both use Google service account JWT auth — `getGoogleToken(env, scopes)` in the worker
- BQ query results capped at `LIMIT 100` rows (increased from 50)

---

## Known Issues / History

### Make.com 401 / 404 debugging
- Old worker targeted `eu1.make.com` — everything returned 401
- Account is confirmed on **eu2.make.com** (verified via `/make-debug`)
- Data store records endpoint is `GET /data-store-records?dataStoreId={id}` (root collection), NOT `GET /data-stores/{id}/data-store-records` (returns 404)

### Layout
- `.main-area` uses `width: calc(100vw - 220px)` with `margin-left: 220px; box-sizing: border-box`
- `.seo-view-wrap` has `padding: 0; width: 100%`
- Calendar colours use `var(--navy)` and `var(--coral)` — not green

### Client assignee filtering
- Fallback must use `MAKE_CLIENTS_FALLBACK.map(c => ({ ...c }))` (NOT `{ ...c, assignee: '' }`) to preserve assignees
- Meeting notes filter: `c.assignee &&` (not `!c.assignee ||`) to exclude unassigned clients from non-admin view
- Timesheet client dropdown: admin check includes `&& !isTeamView()` so Holly/Sarah see only assigned clients when in team view

---

## Deployment

1. **Frontend**: Push to `main` branch — auto-deploys via Cloudflare Pages (or equivalent)
2. **Worker**: Copy `cloudflare-worker.js` into Cloudflare Workers editor and deploy
   - Worker must have all secrets configured (see table above)
   - After deploying new worker, test by visiting `https://livetech-claude-proxy.lively-morning-b71a.workers.dev/make-debug`

Development branch: `claude/seo-meeting-notes-integration-8ITyC`

---

## Debug Endpoints

`GET https://livetech-claude-proxy.lively-morning-b71a.workers.dev/make-debug`

Returns JSON with:
- Make.com token preview
- Results of listing data stores (with and without teamId)
- Results of listing teams and organizations

Useful for diagnosing Make.com auth or finding data store IDs after account changes.
