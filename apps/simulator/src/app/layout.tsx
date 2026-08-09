import './global.css';

export const metadata = {
  title: 'SISPik Fleet Simulator',
  description: 'Development fleet driving simulator',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
