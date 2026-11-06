import './globals.css';
import type { Metadata } from 'next';
import { Cairo } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/lib/auth-context';

const cairo = Cairo({ subsets: ['arabic', 'latin'], weight: ['300', '400', '600', '700'] });

export const metadata: Metadata = {
  title: 'FOCUS ON-TAXI - خدمة توصيل فاخرة',
  description: 'خدمة توصيل فاخرة في الأردن - احجز مشوارك الآن',
  manifest: '/manifest.json',
  applicationName: 'FOCUS ON-TAXI',
  appleWebApp: {
    capable: true,
    title: 'FOCUS ON-TAXI',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: {
    telephone: false,
    address: false,
    email: false,
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'apple-mobile-web-app-title': 'FOCUS ON-TAXI',
    'theme-color': '#C9A86A',
    'msapplication-TileColor': '#C9A86A',
    'msapplication-tap-highlight': 'no',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-256.png', sizes: '256x256', type: 'image/png' },
      { url: '/icons/icon-384.png', sizes: '384x384', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
    shortcut: ['/icons/icon-192.png'],
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className="dark">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#C9A86A" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="FOCUS ON-TAXI" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <link rel="icon" href="/icons/icon-192.png" type="image/png" />
        <link rel="shortcut icon" href="/icons/icon-192.png" />
      </head>
      <body className={`${cairo.className} antialiased`} style={{ background: 'linear-gradient(180deg, #0A1931 0%, #162447 100%)', color: '#E8D5A3' }}>
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
