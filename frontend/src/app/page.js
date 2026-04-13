import Head from 'next/head';
import Script from 'next/script';
import dynamic from 'next/dynamic';
import '../styles/globals.css';

// Dynamic import to avoid SSR issues with Telegram WebApp SDK
const App = dynamic(() => import('./App.js'), { ssr: false });

export default function Page() {
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="theme-color" content="#0A0A0A" />
        <title>VoiceMatch</title>
      </Head>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      <App />
    </>
  );
}
