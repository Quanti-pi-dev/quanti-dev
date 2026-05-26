import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/auth-context';
import { ToastProvider } from '@/components/toast';
import { CommandPaletteProvider } from '@/components/command-palette';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' });

export const metadata: Metadata = {
  title: 'QuantiPi Admin',
  description: 'Admin control panel for the QuantiPi learning platform',
  icons: {
    icon: '/favicon-brand.jpg',
    apple: '/favicon-brand.jpg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${geist.variable} font-sans antialiased bg-zinc-950 text-white`}>
        <AuthProvider>
          <ToastProvider>
            <CommandPaletteProvider>
              {children}
            </CommandPaletteProvider>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
