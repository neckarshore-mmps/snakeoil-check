import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Snake-Oil-or-Gold Check',
  description: 'Neutraler Reality-Check für Online-Coachings und High-Ticket-Angebote.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
