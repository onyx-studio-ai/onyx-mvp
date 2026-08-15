import './globals.css';
import { Analytics } from '@vercel/analytics/next';

// manifest 供 PWA/網頁推播用(iOS 要「加入主畫面」才能收推播,靠這份 manifest)
export const metadata = { manifest: '/manifest.json' };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
