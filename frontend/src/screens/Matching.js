import { useEffect, useState } from 'react';
import { Button, Screen } from '../components/index.js';

export default function MatchingScreen({ onCancel }) {
  const [dots, setDots] = useState('');
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const dotsTimer = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 500);
    const elapsedTimer = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => { clearInterval(dotsTimer); clearInterval(elapsedTimer); };
  }, []);

  return (
    <Screen className="items-center justify-center px-6">
      <div className="animate-fade-in flex flex-col items-center gap-10 w-full max-w-sm">

        {/* Animated ring */}
        <div className="relative flex items-center justify-center">
          <div className="absolute w-40 h-40 rounded-full border border-white/10 animate-pulse-ring" />
          <div className="absolute w-52 h-52 rounded-full border border-white/5  animate-pulse-ring" style={{ animationDelay: '0.7s' }} />
          <div className="w-28 h-28 rounded-full bg-surface border border-border flex items-center justify-center text-5xl z-10">
            🔍
          </div>
        </div>

        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">Looking for someone{dots}</h2>
          <p className="text-muted text-sm">
            {elapsed < 15
              ? 'Finding you a great match'
              : elapsed < 40
              ? 'Almost there, hang tight'
              : 'This is taking longer than usual...'}
          </p>
        </div>

        <div className="w-full bg-surface rounded-2xl border border-border p-4 text-center">
          <div className="text-2xl font-bold tabular-nums">{elapsed}s</div>
          <div className="text-muted text-xs mt-1">Time in queue</div>
        </div>

        <Button variant="ghost" size="lg" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </Screen>
  );
}
