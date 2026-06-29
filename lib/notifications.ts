import webpush from 'web-push';
import { Resend } from 'resend';
import { Job, PushSubscriptionData } from '@/types';
import { logNotification } from './db';

// Configure VAPID lazily (keys may not be set in all environments)
function configureVapid() {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (pub && priv) {
    webpush.setVapidDetails(
      process.env.VAPID_MAILTO || 'mailto:admin@example.com',
      pub,
      priv
    );
  }
}

const resend = new Resend(process.env.RESEND_API_KEY);

// ─── Push Notifications ──────────────────────────────────────────────────────

export async function sendPushNotification(
  subscription: PushSubscriptionData,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<boolean> {
  configureVapid();
  try {
    await webpush.sendNotification(
      subscription as webpush.PushSubscription,
      JSON.stringify({ title, body, data })
    );
    await logNotification({
      type: 'push',
      recipient: data?.driverName as string ?? 'unknown',
      subject: title,
      body,
      status: 'sent',
      sentAt: new Date().toISOString(),
    });
    return true;
  } catch (err) {
    await logNotification({
      type: 'push',
      recipient: data?.driverName as string ?? 'unknown',
      subject: title,
      body,
      status: 'failed',
      sentAt: new Date().toISOString(),
      error: String(err),
    });
    return false;
  }
}

// ─── Email Templates ─────────────────────────────────────────────────────────

function baseEmailTemplate(content: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 0; background: #f4f4f5; }
    .container { max-width: 600px; margin: 24px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .header { background: #2563eb; padding: 24px; color: white; }
    .header h1 { margin: 0; font-size: 20px; }
    .body { padding: 24px; }
    .detail-row { display: flex; padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
    .detail-label { font-weight: 600; color: #64748b; min-width: 140px; }
    .detail-value { color: #1e293b; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 13px; font-weight: 600; }
    .badge-issue { background: #fef2f2; color: #dc2626; }
    .badge-done { background: #f0fdf4; color: #16a34a; }
    .badge-access { background: #fff7ed; color: #ea580c; }
    .footer { padding: 16px 24px; background: #f8fafc; color: #94a3b8; font-size: 12px; text-align: center; }
    .btn { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>🚚 Driver Workflow</h1></div>
    <div class="body">${content}</div>
    <div class="footer">Driver Workflow System &mdash; Automated notification</div>
  </div>
</body>
</html>`;
}

// ─── Email senders ────────────────────────────────────────────────────────────

export async function sendIssueAlertEmail(job: Job): Promise<void> {
  const html = baseEmailTemplate(`
    <h2 style="margin-top:0;color:#dc2626;">⚠️ Issue Reported</h2>
    <p>A driver has reported an issue on a job.</p>
    <div class="detail-row"><span class="detail-label">Driver</span><span class="detail-value">${job.driverName}</span></div>
    <div class="detail-row"><span class="detail-label">Customer</span><span class="detail-value">${job.customerName}</span></div>
    <div class="detail-row"><span class="detail-label">Address</span><span class="detail-value">${job.address}</span></div>
    <div class="detail-row"><span class="detail-label">Job Type</span><span class="detail-value">${job.jobType}</span></div>
    <div class="detail-row"><span class="detail-label">Issue Notes</span><span class="detail-value">${job.issueNotes || 'No notes provided'}</span></div>
    <div class="detail-row"><span class="detail-label">Time</span><span class="detail-value">${new Date().toLocaleString('en-AU')}</span></div>
    ${job.mapLink ? `<a href="${job.mapLink}" class="btn">View on Map</a>` : ''}
  `);

  await sendEmail(
    process.env.ADMIN_EMAIL!,
    `⚠️ Issue Reported – ${job.customerName}`,
    html
  );
}

export async function sendCantAccessEmail(job: Job): Promise<void> {
  const html = baseEmailTemplate(`
    <h2 style="margin-top:0;color:#ea580c;">🔒 Could Not Access</h2>
    <p>A driver could not access a property.</p>
    <div class="detail-row"><span class="detail-label">Driver</span><span class="detail-value">${job.driverName}</span></div>
    <div class="detail-row"><span class="detail-label">Customer</span><span class="detail-value">${job.customerName}</span></div>
    <div class="detail-row"><span class="detail-label">Address</span><span class="detail-value">${job.address}</span></div>
    <div class="detail-row"><span class="detail-label">Phone</span><span class="detail-value">${job.phone}</span></div>
    <div class="detail-row"><span class="detail-label">Time</span><span class="detail-value">${new Date().toLocaleString('en-AU')}</span></div>
    ${job.mapLink ? `<a href="${job.mapLink}" class="btn">View on Map</a>` : ''}
  `);

  await sendEmail(
    process.env.ADMIN_EMAIL!,
    `🔒 Could Not Access – ${job.customerName}`,
    html
  );
}

export async function sendCallAheadEmail(job: Job): Promise<void> {
  if (!job.phone) return;
  const html = baseEmailTemplate(`
    <h2 style="margin-top:0;color:#2563eb;">📞 Service Reminder</h2>
    <p>Dear ${job.customerName},</p>
    <p>This is a friendly reminder that your service is scheduled for <strong>today</strong>.</p>
    <div class="detail-row"><span class="detail-label">Service</span><span class="detail-value">${job.jobType}</span></div>
    <div class="detail-row"><span class="detail-label">Items</span><span class="detail-value">${job.items}</span></div>
    <div class="detail-row"><span class="detail-label">Notes</span><span class="detail-value">${job.notes || 'None'}</span></div>
    <p style="margin-top:16px;color:#64748b;font-size:14px;">If you have any questions, please contact our office.</p>
  `);

  // In production this would go to the customer's email if stored
  // For now we log and send to admin
  await sendEmail(
    process.env.ADMIN_EMAIL!,
    `📞 Call Ahead Required – ${job.customerName}`,
    html
  );
}

export async function sendRunReadyEmail(jobs: Job[]): Promise<void> {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });

  const byDriver: Record<string, number> = {};
  for (const job of jobs) {
    byDriver[job.driverName] = (byDriver[job.driverName] ?? 0) + 1;
  }

  const driverRows = Object.entries(byDriver)
    .map(([name, count]) =>
      `<div class="detail-row"><span class="detail-label">${name}</span><span class="detail-value">${count} job${count !== 1 ? 's' : ''}</span></div>`
    )
    .join('');

  const html = baseEmailTemplate(`
    <h2 style="margin-top:0;color:#1e293b;">📋 Tomorrow's Run is Ready</h2>
    <p>The automated run generator has created <strong>${jobs.length} job${jobs.length !== 1 ? 's' : ''}</strong> for <strong>${dateStr}</strong>.</p>
    ${driverRows}
    <p style="margin-top:16px;color:#64748b;font-size:14px;">The run goes live to drivers at 5am. Log in to review or adjust before then.</p>
  `);

  await sendEmail(
    process.env.ADMIN_EMAIL!,
    `📋 Tomorrow's Run Ready – ${dateStr} (${jobs.length} jobs)`,
    html
  );
}

export async function sendDailySummaryEmail(stats: {
  total: number;
  done: number;
  issues: number;
  cantAccess: number;
  pending: number;
}): Promise<void> {
  const date = new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });
  const html = baseEmailTemplate(`
    <h2 style="margin-top:0;color:#1e293b;">📊 Daily Summary – ${date}</h2>
    <div class="detail-row"><span class="detail-label">Total Jobs</span><span class="detail-value"><strong>${stats.total}</strong></span></div>
    <div class="detail-row"><span class="detail-label">Completed</span><span class="detail-value" style="color:#16a34a;font-weight:600;">✅ ${stats.done}</span></div>
    <div class="detail-row"><span class="detail-label">Issues</span><span class="detail-value" style="color:#dc2626;font-weight:600;">⚠️ ${stats.issues}</span></div>
    <div class="detail-row"><span class="detail-label">Could Not Access</span><span class="detail-value" style="color:#ea580c;font-weight:600;">🔒 ${stats.cantAccess}</span></div>
    <div class="detail-row"><span class="detail-label">Still Pending</span><span class="detail-value" style="color:#ca8a04;font-weight:600;">⏳ ${stats.pending}</span></div>
    <div class="detail-row"><span class="detail-label">Completion Rate</span><span class="detail-value"><strong>${stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0}%</strong></span></div>
  `);

  await sendEmail(
    process.env.ADMIN_EMAIL!,
    `📊 Daily Summary – ${date}`,
    html
  );
}

// ─── Core email sender ────────────────────────────────────────────────────────

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  try {
    await resend.emails.send({
      from: process.env.EMAIL_FROM || 'noreply@example.com',
      to,
      subject,
      html,
    });
    await logNotification({
      type: 'email',
      recipient: to,
      subject,
      body: html.substring(0, 200),
      status: 'sent',
      sentAt: new Date().toISOString(),
    });
  } catch (err) {
    await logNotification({
      type: 'email',
      recipient: to,
      subject,
      body: html.substring(0, 200),
      status: 'failed',
      sentAt: new Date().toISOString(),
      error: String(err),
    });
  }
}
