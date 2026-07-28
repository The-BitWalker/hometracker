import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import InfoModal from '@/components/InfoModal';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-plus-jakarta',
});

export const metadata = {
  title: 'HOMETRACKER',
  description: 'Real-time predictive family location circle & ETA tracking. Know where they are. Know when they\'re home.',
  icons: { icon: '/logo.svg' },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${plusJakarta.variable} min-h-full w-full`}>
      <head>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
      </head>
      <body suppressHydrationWarning className="bg-[#fdfdfd] text-slate-800 antialiased font-[family-name:var(--font-plus-jakarta)] selection:bg-[#5621bf] selection:text-white min-h-full">
        {children}
        <InfoModal />
      </body>
    </html>
  );
}
