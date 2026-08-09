import './global.css';
import { Providers } from '@/components/providers';

export const metadata = {
  title: 'Rotom Central',
  description: 'Municipal waste operations command center',
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
