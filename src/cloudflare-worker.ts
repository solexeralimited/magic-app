// Entry point Cloudflare actually runs (see wrangler.jsonc "main"). Wraps the
// OpenNext-generated worker to add the scheduled() handler Vercel's vercel.json
// "crons" covered on that host — Cloudflare has no equivalent of hitting an
// HTTP path on a schedule, so this calls the same routes itself.
import nextWorker from '../.open-next/worker.js';

const CRON_ROUTES: Record<string, string> = {
  '0 10 * * *': '/api/cron/generate-run',
  '0 16 * * *': '/api/cron/promote-run',
};

export default {
  fetch: nextWorker.fetch,

  async scheduled(event: ScheduledEvent, env: Record<string, string>, ctx: ExecutionContext) {
    const path = CRON_ROUTES[event.cron];
    if (!path) return;
    const url = new URL(path, 'https://internal.worker');
    const res = await nextWorker.fetch(
      new Request(url, { headers: { authorization: `Bearer ${env.CRON_SECRET}` } }),
      env,
      ctx
    );
    if (!res.ok) {
      console.error(`Cron ${event.cron} (${path}) failed: ${res.status} ${await res.text()}`);
    }
  },
};
