import type { Metadata } from 'next';
import { DM_Sans } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { Providers } from './providers';
import { ToastWrapper } from './toast-wrapper';
import { AppShell } from './app-shell';

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'HubSpot AI Wrapper',
  description: 'Full-stack HubSpot AI Wrapper application',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.ReactElement {
  return (
    <html lang="en" className={dmSans.variable}>
      <body className="font-sans antialiased">
        <AuthProvider>
          <Providers>
            <ToastWrapper>
              <AppShell>{children}</AppShell>
            </ToastWrapper>
          </Providers>
        </AuthProvider>
      </body>
    </html>
  );
}
