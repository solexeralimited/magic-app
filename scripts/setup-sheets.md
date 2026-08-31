# Google Sheets Setup

How to connect Thunderbox to a Google Sheet. Most of this is done once.

---

## 1. Create the service account (one time)

1. Go to https://console.cloud.google.com and create a project (e.g. "thunderbox").
2. **APIs & Services → Library** → enable the **Google Sheets API**.
3. **IAM & Admin → Service Accounts** → create a service account.
4. On that service account, **Keys → Add key → Create new key → JSON**, and download it.

## 2. Give the app the credentials

Set one environment variable in Railway (**your service → Variables**):

| Variable | Value |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_KEY` | the **entire contents** of the downloaded JSON file |

Paste the whole JSON, including the braces. Nothing else is required — the sheet
itself is chosen in the admin UI, not here.

Two optional fallbacks exist for setups that predate the settings screen:
`GOOGLE_SHEET_ID` and `GOOGLE_SHEET_TAB`. **Settings saved in the UI take
precedence over both**, so a stale env var can make a UI change look like it did
nothing — clear them if you're unsure.

## 3. Share the sheet with the service account ← most commonly missed

The service account is a separate Google identity. It cannot see your
spreadsheet until you share it, and skipping this gives:

```
Google denied access to this spreadsheet
(Sheets API 403: The caller does not have permission)
```

1. In the admin app: **Import & API → Google Sheets Settings**. The service
   account address is shown at the top of the card with a **Copy** button.
   (It also lives in the JSON key as `client_email`.)
2. Open your spreadsheet in Google Sheets → **Share**.
3. Paste the address, set it to **Editor**, untick "Notify people", **Send**.

**Editor, not Viewer** — the app writes permanent job IDs into the sheet on
import, and writes Status / Last Completed back after a run.

## 4. Point the app at the sheet

In **Import & API → Google Sheets Settings**:

- **Sheet URL or ID** — paste the full URL from your browser. The tab id (`gid`)
  in the URL is remembered, so the tab you were looking at is the one that gets
  read.
- **Tab name** — leave blank to use that tab. If you type a name it is checked
  against the spreadsheet, and the real tab names are listed if it doesn't match.
- **Each tab is one driver's run sheet** — tick this when your tabs are named
  after drivers (`TK`, `PJ`, `George`…). One import then loads every matching
  tab and assigns each tab's jobs to that driver. Tab name and default driver
  are ignored in this mode.
- **Default driver** — used only when the sheet has neither a Driver column nor
  driver-named tabs.

Then press **Preview Import (dry run)** — it reports the tab, the header row it
found, where the driver came from, which column supplied the run order, and how
many rows would import, **without changing anything**.

---

## What the importer expects of the sheet

It is deliberately tolerant of real run sheets:

- **Headings need not be on row 1.** A title and a "For the period …" line above
  them are fine; the header row is detected.
- **Days may be abbreviated** — `Mon`, `Tue`, `Wed`, `Thur`, `Fri` or full names.
  Weekend rows are rejected.
- **Run order** can be an unlabelled numeric column beside the day.
- **One row per unit** is fine. Rows sharing a customer and address become a
  single grouped site visit on the driver's phone.

### Recognised column headings

| Field | Accepted headings |
|---|---|
| Customer | Customer, Customer Name, Name |
| Address | Address, Shipping Address, Site Address, Delivery Address, Street |
| Day | Day, Run Day |
| Driver | Driver, Driver Name |
| Unit type | Items, Item, Unit Type, Units, Bins |
| Quantity | Quantity, Qty |
| Notes | Notes, Note, Comments, Comment |
| Phone | Phone, Mobile, Contact, Phone Number |
| Frequency | Frequency, Freq |
| Week cycle | Wk, Week — `A`/`B` import as Fortnightly |
| Next service | Next Service, Next Service Date, Next Due |
| Map link | Map, Map Link, Map URL |
| Call ahead | Call Ahead |
| Order | Order, Job Order, Run Order |
| ID | ID, Job ID — added automatically if absent |

Only **Customer** and **Day** are required. Unrecognised columns are ignored.

### The ID column

On the first import the app appends an **ID** column and writes a permanent id
into each row. That id is what links a sheet row to its job, so results can be
written back to the right row later. **Don't delete or reorder that column.**

---

## Troubleshooting

| Message | Cause |
|---|---|
| `Google denied access to this spreadsheet` | Step 3 — the sheet isn't shared with the service account, or it's Viewer instead of Editor |
| `No spreadsheet found with that ID` | Wrong URL/ID in settings |
| `This sheet has no tab named "X"` | Tab name doesn't match; the message lists the real ones. Clear the field to use the tab from your URL |
| `No tab matches an active driver` | Driver-tab mode is on but no tab name equals an active driver's name — they must match exactly |
| `Unrecognised day "X"` | Day cell isn't Mon–Fri |
| `"X" is not an active driver` | Driver column or default driver names someone not in the Drivers tab, or they're deactivated |
