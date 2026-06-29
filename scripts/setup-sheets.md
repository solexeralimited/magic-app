# Google Sheets Setup Guide

## Step 1: Create a Google Cloud Project

1. Go to https://console.cloud.google.com
2. Create a new project (e.g. "driver-workflow")
3. Enable the **Google Sheets API** under APIs & Services > Library
4. Create a **Service Account** under IAM & Admin > Service Accounts
5. Create a JSON key for the service account and download it

## Step 2: Configure .env.local

From the downloaded JSON key file:
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` = `client_email`
- `GOOGLE_PRIVATE_KEY` = `private_key` (keep the \n characters)
- `GOOGLE_SHEETS_SPREADSHEET_ID` = the ID from your spreadsheet URL

## Step 3: Create the Spreadsheet

Create a Google Spreadsheet and add these sheets (tabs):

### Jobs
Headers (Row 1):
`id | driverName | jobOrder | day | jobType | customerName | address | phone | items | notes | frequency | nextServiceDate | mapLink | callAhead | status | completionTime | issueNotes | notificationSentFlags | createdAt | updatedAt`

### Drivers
Headers (Row 1):
`id | name | email | phone`

Add your drivers here, e.g.:
```
drv-001 | John Smith | john@example.com | 0412345678
drv-002 | Jane Doe   | jane@example.com | 0498765432
```

### TomorrowRuns
(Same headers as Jobs — auto-populated by generate run)

### DailyRuns
(Same headers as Jobs — auto-populated by promote run)

### RunLog
Headers:
`id | jobId | driverName | customerName | address | jobType | completionTime | status | issueNotes | day | date`

### NotificationLog
Headers:
`id | type | recipient | subject | body | status | sentAt | error`

### Messages
Headers:
`id | to | message | sentAt | readAt`

### PushSubscriptions
Headers:
`driverName | subscription | updatedAt`

## Step 4: Share Spreadsheet

Share the spreadsheet with your service account email address (the `client_email` from the JSON key) with **Editor** access.

## Step 5: Generate VAPID Keys

```bash
npx web-push generate-vapid-keys
```

Copy the output into `.env.local`:
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`

## Step 6: Set Up Resend (Email)

1. Sign up at https://resend.com
2. Add your domain and verify DNS
3. Get your API key → `RESEND_API_KEY`
4. Set `EMAIL_FROM` and `ADMIN_EMAIL`

## Step 7: Sample Job Data

Add a test job to the Jobs sheet:
```
job-001 | John Smith | 1 | Monday | Rubbish | Test Customer | 123 Main St | 0412000000 | 2x bins | Gate code 1234 | Weekly | 2026-07-07 | https://maps.google.com/?q=... | false | Pending | | | {} | 2026-06-29T00:00:00Z | 2026-06-29T00:00:00Z
```
