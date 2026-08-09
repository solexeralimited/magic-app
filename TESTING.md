# Testing Thunderbox

Two complementary layers: **automated tests** (run by machines, catch regressions) and
**UAT** (run by people, confirm the app works the way the business expects).

---

## 1. Automated tests

### What's covered

| Layer | File(s) | What it proves |
|---|---|---|
| Unit — scheduling | `tests/unit/schedule.test.ts` | Weekly/fortnightly/3-weekly/4-weekly due logic, weekend handling, status labels |
| Unit — site grouping | `tests/unit/grouping.test.ts` | Grouped Site Visit rules (same customer + address ⇒ one card) and the "2 × Unit" quantity label |
| Unit — sheet columns | `tests/unit/sheets.test.ts` | Column-heading recognition (incl. "Shipping Address", "Unit Type"), A1 conversion, sheet URL parsing |
| Integration — lifecycle | `tests/integration/lifecycle.test.ts` | Against a real Postgres: generate → promote → complete; master schedule never mutated by dispatch; fortnightly dates advance on the master; NotRequired history; promote survives completed jobs (FK regression); Danger-Zone reset order |

### Run them locally

```bash
npm test                  # unit tests — no database needed, ~2s
npm run test:watch        # unit tests, re-run on file save while developing
```

Integration tests need a **disposable** Postgres (they wipe the Job/RunLog tables):

```bash
docker run -d --name tb-test-db -e POSTGRES_PASSWORD=test \
  -e POSTGRES_DB=thunderbox_test -p 5432:5432 postgres:16

export DATABASE_URL="postgresql://postgres:test@localhost:5432/thunderbox_test"
npx prisma migrate deploy
npm run test:integration
```

> ⚠️ Never point `DATABASE_URL` at the production database when running
> integration tests — they delete data by design.

### Continuous integration

`.github/workflows/tests.yml` runs on every push and pull request:

- **unit** job: unit tests + full TypeScript type check
- **integration** job: spins up a throwaway Postgres 16, applies all migrations,
  runs the lifecycle suite

A red ✗ on a commit or PR means something the tests protect is broken — check the
Actions tab for the failing test name, which states the expected behaviour in plain
English.

### Not yet automated

End-to-end browser tests (Playwright) — scripting a real phone-sized browser through
login → tick site checklist → office sees the alert. Worth adding for the core flows
once the UI settles.

---

## 2. UAT — testing by the business

The live checklist (21 tick-able cases, T1–T21) is in the development plan page,
section **"Round 2 — Test Checklist"**. Ticks save in your browser so you can spread
testing over several days.

### Setup for a clean test round

1. **Admin → Import & API → Danger Zone**: type `RESET` → **Clear All Data**
   (drivers, PINs, logins, API keys and Sheets settings are kept).
2. **Import from Sheets** (or CSV) to load the schedule.
3. **Dashboard → Generate Tomorrow**, then **Promote to Daily**.
4. Use **two devices**: laptop logged in as admin, phone logged in as a driver —
   many cases check that an action on one shows up on the other.

### Suggested order

- T1–T5 (site visits) and T6 (quantity) first — the core driver experience
- T9–T14 (dispatch editing + generate guard) — the office workflow
- T15–T17 (replace import + settings), T18–T19 (statuses), T20–T21 (batch + reset)
- T14 and T19 need an overnight wait — start them early in the round

### Reporting problems

For each failed case note: the case number, what you did, what you expected
(the green text), and what actually happened, plus a screenshot. One message per
case keeps fixes fast.
