import { Screen } from '../components/index.js';

export default function LoadingScreen() {
  return (
    <Screen className="items-center justify-center">
      <div className="animate-fade-in flex flex-col items-center gap-6">
        <div className="w-20 h-20 rounded-2xl bg-white flex items-center justify-center text-4xl shadow-lg">
          🎙
        </div>
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-xl font-bold text-white">VoiceMatch</h1>
          <p className="text-muted text-sm">Connecting to Telegram...</p>
        </div>
        <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>
    </Screen>
  );
}
