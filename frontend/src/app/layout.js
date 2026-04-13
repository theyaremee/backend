export const metadata = {
  title: 'VoiceMatch',
  description: 'Random voice chat on Telegram',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
