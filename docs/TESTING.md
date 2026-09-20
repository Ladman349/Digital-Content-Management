# Tests

| What | Where | Run it |
| --- | --- | --- |
| Backend (API, separation between clients, reports, activity, health) | `backend/tests` | `cd backend; .venv\Scripts\python -m pytest tests -q` |
| CMS type-check, lint, build | `frontend` | `npx tsc -b --noEmit; npx eslint src --max-warnings 0; npx vite build` |
| CMS in a real browser | `frontend/e2e` | `cd frontend; npm run e2e` |
| TV player unit tests | `android` | `gradlew testProdDebugUnitTest` |

All four run on GitHub for every push (`.github/workflows/ci.yml`), each only when its part of the
repository changed.

## Browser tests

`npm run e2e` starts two servers and drives Chromium through the CMS:

* `backend/e2e_server.py`, the real API on a **brand-new SQLite file in a temporary folder**. It
  overrides `DATABASE_URL` and the Supabase settings before the app is imported and refuses to start
  on anything but SQLite, so the tests cannot touch a real database even on a machine that holds
  production credentials. The folder is deleted when the server stops.
* the CMS dev server on port 5183, pointed at that API.

The tests tell one story in order: an empty installation is open; creating the first administrator
turns sign-in on; a wrong password is refused; two clients are set up; media is uploaded; a screen is
handed over with its content; a client sees only their own screens and content and no operator
pages; the activity log and reports open for a client; "Signed-in devices" signs another browser
out; signing out ends the session.

First run on a new machine: `npx playwright install chromium`. Add `-- --ui` to watch and step
through, and look in `frontend/test-results` for a trace and a screenshot of any failure.

## What the SQLite suites cannot see

The backend tests and the browser tests both run on SQLite, which forgives SQL that PostgreSQL
refuses. The report's bucket arithmetic once passed every test and failed on a real database.
Queries of that kind are pinned by rendering them for PostgreSQL
(`tests/test_reports_postgres_sql.py`), and anything that adds a query with arithmetic, casts or
grouping should be run once against the local PostgreSQL before it ships.
