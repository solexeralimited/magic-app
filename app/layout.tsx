import type { Metadata, Viewport } from 'next';
import Providers from './providers';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'Driver Workflow',
  description: 'Driver job management system',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Driver Workflow',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#2563eb',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="min-h-screen">
        <Providers>{children}</Providers>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').catch(console.error);
                });
              }
              // Keep screen awake
              if ('wakeLock' in navigator) {
                async function requestWakeLock() {
                  try { await navigator.wakeLock.request('screen'); } catch(e) {}
                }
                document.addEventListener('visibilitychange', () => {
                  if (document.visibilityState === 'visible') requestWakeLock();
                });
                requestWakeLock();
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
