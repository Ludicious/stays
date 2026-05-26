import type { Metadata } from 'next';
import { Playfair_Display, DM_Sans, DM_Mono } from 'next/font/google';
import Script from 'next/script';
import Nav from '@/components/Nav';
import './globals.css';

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  variable: '--font-playfair',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-dm-sans',
  display: 'swap',
});

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-dm-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'Stays', template: '%s · Stays' },
  description: 'Noteworthy Nomads stay tracker',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;

  return (
    <html lang="en" className={`${playfair.variable} ${dmSans.variable} ${dmMono.variable}`}>
      <body>
        <Nav />
        {children}
        {mapsKey && (
          <Script
            src={`https://maps.googleapis.com/maps/api/js?key=${mapsKey}&libraries=places&callback=Function.prototype`}
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  );
}
