import './global.css';
import { Providers } from '@/components/providers';

export const metadata = {
  title: 'Dashboard',
  description: 'SispikHacks administrator dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
