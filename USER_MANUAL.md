# Thunderbox — User Manual

The Driver Workflow System. This manual covers both sides of the app: what
drivers do on their phones, and what the office does from the admin screens.

- [Part 1 — Logging in](#part-1--logging-in)
- [Part 2 — For drivers](#part-2--for-drivers)
- [Part 3 — For the office](#part-3--for-the-office)
- [Part 4 — Managing people](#part-4--managing-people)
- [Part 5 — The Google Sheet](#part-5--the-google-sheet)
- [Part 6 — How the daily cycle works](#part-6--how-the-daily-cycle-works)
- [Troubleshooting](#troubleshooting)

---

## Part 1 — Logging in

Everyone starts at the same web address. The login screen has two tabs:
**🚚 Driver** and **🛡 Admin**.

### Drivers — name and PIN

1. Tap **🚚 Driver**
2. Choose your name from the list
3. Enter your **PIN** (4–6 digits)
4. Tap **Sign In**

Your name only appears in the list if the office has created your account and
set a PIN. You cannot set or recover your own PIN — if you've forgotten it, the
office sets a new one for you (see [Part 4](#part-4--managing-people)). PINs are
stored scrambled, so nobody, including the office, can look yours up.

### Office staff — email and password

1. Tap **🛡 Admin**
2. Enter your **email address** (e.g. `admin@thunderbox.co.nz`)
3. Enter your **password**
4. Tap **Sign In as Admin**

Your email address *is* your username. If it's changed, you log in with the new
one from then on.

The two roles are kept apart: a driver who lands on an admin page is sent back
to their run, and vice versa.

### Installing it on a phone (recommended for drivers)

Thunderbox installs like a normal app, which gives a full screen and a home
screen icon:

- **iPhone (Safari):** Share → **Add to Home Screen**
- **Android (Chrome):** ⋮ menu → **Install app** / **Add to Home screen**

---

## Part 2 — For drivers

### Today's Run

Your jobs for the day, in run order. Each card shows:

- **Job number** and the **address** in large text
- **Customer name**
- **Quantity and unit type** — e.g. "2 × Non-Flush Units"
- **📞 Call** badge when the customer must be phoned before arrival
- A coloured stripe for the job type — Service (green), Delivery (yellow),
  Pickup (red), Adhoc (orange)
- **Notes** for that job
- **Call** and **Map** buttons

The **Map** button uses the exact map link the office set for that site when
there is one (the button turns amber); otherwise it searches the address in
Google Maps.

### Finishing a job

Three buttons at the bottom of each card:

| Button | Use it when |
|---|---|
| **✅ Done** | Serviced normally |
| **🔒 No Access** | You couldn't get to the unit — locked gate, blocked driveway |
| **⚠️ Issue** | Something's wrong — damage, unit missing, site problem |

**Issue** asks you to type what happened before it saves. Both **Issue** and
**No Access** appear in the office's Alerts straight away so they can act on it
while you carry on.

Completed jobs move into a **Completed** section at the bottom, which you can
open to check what you've done. Made a mistake? Open that section and tap
**Reopen job**.

### Sites with several units — the Service Checklist

When a site has more than one job (say twelve loos at one construction site),
they're combined into **one card** showing e.g. **"12 Jobs on Site"**, rather
than twelve near-identical cards. The address, phone, map and call-ahead are
shown once.

Tap the card to open the **Service Checklist**:

1. Each line shows the **job number**, the **unit type** and any **notes just
   for that unit** ("Rear gate beside workshop")
2. Tick the units you serviced — or tap **Select All**
3. Tap **Complete Selected**

If you ticked everything, you're done and the site disappears from your run.

If any units are **not** ticked, you'll be asked what happened to each one
before the visit can be closed: **No Access** or **Issue**, plus a comment. Then
tap **Submit Site Visit**.

The whole site is saved in one go, so it still works properly on a patchy
connection — you won't get half of it saved.

### Tomorrow tab

A read-only look at tomorrow's run once the office has prepared it. You can't
change anything here — it's for planning your morning.

At the top is **Tomorrow's Preparation**: every **Delivery**, **Pickup** and
**Adhoc** job pulled out so you can load the truck the night before. Each shows
the quantity and unit type, address, all notes, whether to call ahead, and where
it falls in the run ("Job 11 of 38"). Those jobs still appear in their normal
place in the list below — the summary is just so you don't have to hunt for
them.

### Messages and notifications

The **envelope icon** at the top shows messages from the office, with a badge
for unread ones. Opening it marks them read.

Tap the **bell icon** to turn on notifications. You'll get one when your run is
ready each morning. Worth enabling — it's how you know the day has been
promoted.

---

## Part 3 — For the office

### Dashboard

**Run Management** — the buttons that drive the day:

| Button | What it does |
|---|---|
| **Generate Tomorrow** | Builds tomorrow's run from the master schedule |
| **Promote to Daily** | Makes the prepared run live for drivers |
| **Send End-of-Day Summary Email** | Emails today's results |
| **Import from Sheets** | Reloads the master schedule from Google Sheets |
| **Sync Results to Sheets** | Writes today's outcomes back to the sheet |

Both Generate and Promote normally run automatically overnight — the buttons are
for when you need to do it early, or redo it.

**Tomorrow's Run — Dispatch.** Once a run is generated, you can rearrange it here
*without touching the master schedule*:

- **▲ ▼** to reorder a driver's jobs
- **Reassign** — tick several jobs, pick another driver, **Move**
- **✕** to push a job out of tomorrow (it stays in the master schedule for future weeks)
- **+ Adhoc** to add a one-off job

This is the "George called in sick" tool. Move his 25 jobs to Dom for tomorrow
and next Tuesday's recurring allocation is unchanged.

**All Drivers overview** — a progress bar per driver with counts of issues and
no-access jobs. Click one to drill into that driver.

**Alerts** — every Issue and No Access as it happens, with the driver's comment.
Two buttons on each:

- **Reschedule** — moves it to the **Task Bar** to be reassigned
- **Not Required** — closes it off for today without re-queuing; recorded in
  History and written back to the sheet

**Task Bar** — jobs waiting for a home. Pick a driver, press **Assign**, and it
joins their run immediately.

**Today's Jobs** — searchable list of the selected driver's day, with a
**Reassign** mode for moving several jobs at once.

### Jobs tab — the master schedule

The permanent recurring schedule. Two views, toggled top-right:

- **Card view** — drag the grip handle to reorder, then **Save Order**
- **Sheet view** — a dense table, with **Export CSV**

**Select mode** (the **Select** button) enables bulk work: tick jobs — or
**Select All** — then:

- **Move** them to a different driver and/or day
- **Pull into Tomorrow** — bring work forward into tomorrow's run
- **Delete**

**+ Add** creates a job by hand. Each job carries driver, day, order, type,
frequency, customer, address, phone, next service date, unit type, quantity,
notes, map link and call-ahead.

> Editing here changes the schedule **permanently**, for every future week. For
> one-off changes use the Tomorrow dispatch editor instead.

### History

Every completed, not-required and failed job for the last 14 days. Filter by
text, driver, status or job type, and **Export CSV** for reporting.

### Message

Send a message to **All Drivers** or one driver. It appears under their envelope
icon and as a push notification. Recent messages are listed below, marked
**Read** once seen.

### Notif. Log

Every notification the system has sent — push and email — with `sent` or
`failed`. The first place to look when someone says they didn't get something.

### Import & API

- **System** — where the app is hosted, which database it's connected to, and
  green/red chips for each integration. Check here first if something seems
  misconfigured.
- **Google Sheets Settings** — see [Part 5](#part-5--the-google-sheet)
- **Bulk Import Jobs** — upload a CSV instead of using Sheets. **Download
  Template** gives you the right columns.
- **API Integration** — create API keys for other systems to push jobs in
- **Danger Zone — Start Over** — see below

### Danger Zone — clearing everything

Type `RESET`, press **Clear All Data**, confirm.

**Deletes:** all jobs, run history, messages, notification log.
**Keeps:** drivers and PINs, admin logins, API keys, Google Sheets settings.

Use it to clear out test data before going live. It cannot be undone.

---

## Part 4 — Managing people

### Adding a driver

**Drivers tab → + Add Driver**

1. **Name** — must match the driver's tab name in the Google Sheet *exactly* if
   you use driver tabs (`TK`, `PJ`, `George`…)
2. **Email** and **Phone** — optional
3. **PIN** — 4 to 6 digits. This is what they log in with; tell them directly.
4. **Add Driver**

The badge on each driver shows **PIN set** or **No PIN**. A driver with no PIN
cannot log in.

> The name can't be changed after creation, because jobs are linked to it.
> If someone's name is wrong, create a new driver and deactivate the old one.

### Resetting a forgotten PIN

**Drivers tab → ✏️ edit → New PIN → Save Changes.** Nobody can look up an
existing PIN — it's stored scrambled — so a forgotten PIN is always replaced,
never recovered.

### Deactivating a driver

Press the 🗑 button. They can no longer log in and won't appear on the login
screen or in driver dropdowns, but their history is kept. Reactivate any time by
editing them and ticking **Account Active**.

### Adding an office user

**Admin Users tab → + Add Admin**

1. **Full Name**
2. **Email** — this is their login, e.g. `dispatch@thunderbox.co.nz`
3. **Password** — minimum 8 characters
4. **Create Admin**

Admins have full access, including the Danger Zone. There are no partial admin
permissions.

### Changing an admin's email or password

**Admin Users tab → ✏️ edit.** Leave the password blank to keep the current one.

> **Changing your own email changes your own login.** Safest order: create the
> new admin account first, log in as it to check it works, *then* remove the old
> one. You can't delete the account you're signed in as — it shows a **You**
> badge and no delete button.

---

## Part 5 — The Google Sheet

The sheet is the source of truth for the recurring schedule. **Import from
Sheets** replaces the master schedule with what's in the sheet — including
removing anything created by hand in the app.

### Settings (Import & API → Google Sheets Settings)

- **Service account address** — shown at the top with a **Copy** button. Your
  sheet must be shared with this address as **Editor**, or nothing works. Editor
  is required because the app writes job IDs and results back.
- **Sheet URL or ID** — paste the browser URL. The tab you were looking at is
  remembered.
- **Each tab is one driver's run sheet** — tick this when tabs are named after
  drivers. One import then loads the whole team, each tab's jobs assigned to that
  driver.
- **Tab name / Default driver** — only used when the above is off.

Always press **Preview Import (dry run)** first. It reports the tab, the header
row it found, where the driver came from, the run-order column, per-tab job
counts and any rows it would skip — **without changing anything**.

### What the sheet needs

Only **Customer** and **Day** are required. Headings can sit below a title row,
days can be abbreviated (`Mon`, `Thur`), and the run order can be an unlabelled
numbered column. Recognised headings include Customer Name, Shipping Address,
Day, Phone, Items/Unit Type, Quantity, Comments/Notes, Frequency, Wk, Next
Service Date, Map Link and Call Ahead.

> **Don't delete or move the ID column.** The app adds it on first import and
> uses it to write results back to the right row.

### Sending results back

**Sync Results to Sheets** writes each completed job's status and completion time
into its row. Statuses written: Done, Could Not Access, Issue, Not Required.

---

## Part 6 — How the daily cycle works

Three separate lists, which is what keeps day-to-day changes from corrupting
the permanent schedule:

| List | What it is |
|---|---|
| **Master (Jobs tab)** | The permanent recurring schedule, imported from Sheets |
| **Tomorrow** | A working copy of tomorrow's run — edit freely |
| **Daily** | What drivers are working on right now |

**Generate Tomorrow** copies the jobs due tomorrow from Master into Tomorrow.
Weekly jobs are always due; fortnightly, 3-weekly and 4-weekly jobs are only
included once their **Next Service Date** arrives. It refuses to build a weekend
run.

The office then adjusts the Tomorrow copy as needed. Nothing done here touches
Master.

**Promote to Daily** makes that prepared run live and notifies the drivers.

When a driver marks a recurring job **Done**, its Next Service Date rolls forward
(14, 21 or 28 days) on the *master* record — which is what stops it reappearing
every week.

Both steps run automatically overnight: Generate late evening, Promote before
dawn. Generate skips if a run has already been prepared, so afternoon dispatch
work is never overwritten. Promote refuses if nothing has been prepared, so it
can't wipe a live run.

---

## Troubleshooting

| Problem | Cause / fix |
|---|---|
| Driver's name isn't on the login screen | No account, no PIN set, or deactivated — check the Drivers tab |
| "Invalid name or PIN" | PIN is wrong; the office sets a new one |
| Driver sees no jobs | The run hasn't been promoted yet, or they have none today |
| Driver didn't get a notification | Check they enabled the bell, then check Notif. Log |
| "Google denied access to this spreadsheet" | The sheet isn't shared with the service account as Editor |
| "This sheet has no tab named X" | Clear the Tab Name field, or use the exact name listed in the message |
| "No tab matches an active driver" | Tab names and driver names must match exactly |
| Rows skipped on import | The dry run lists each one with its row number and reason |
| A job reappears every week | Its frequency or Next Service Date is wrong in the sheet |
| Nothing to promote | Generate Tomorrow first — Promote won't clear a live run |
