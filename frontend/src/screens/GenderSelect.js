import { useState } from 'react';
import { Button, Screen } from '../components/index.js';

export default function GenderSelect({ onSelect }) {
  const [selected, setSelected] = useState(null);
  const [saving, setSaving]     = useState(false);

  async function handleContinue() {
    if (!selected) return;
    setSaving(true);
    await onSelect(selected);
    setSaving(false);
  }

  return (
    <Screen className="items-center justify-center px-6">
      <div className="animate-fade-in w-full max-w-sm flex flex-col gap-8">

        <div className="text-center">
          <div className="text-5xl mb-4">👋</div>
          <h1 className="text-2xl font-bold mb-2">Welcome to VoiceMatch</h1>
          <p className="text-muted text-sm leading-relaxed">
            Tell us your gender to get started. This helps with matching.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {[
            { id: 'male',   emoji: '👨', label: 'Male' },
            { id: 'female', emoji: '👩', label: 'Female' },
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => setSelected(opt.id)}
              className={`w-full flex items-center gap-4 p-5 rounded-2xl border transition-all duration-150 active:scale-95 ${
                selected === opt.id
                  ? 'bg-white text-black border-white'
                  : 'bg-surface text-white border-border hover:border-white/30'
              }`}
            >
              <span className="text-3xl">{opt.emoji}</span>
              <span className="text-lg font-medium">{opt.label}</span>
              {selected === opt.id && <span className="ml-auto text-black">✓</span>}
            </button>
          ))}
        </div>

        <Button
          variant="primary"
          size="lg"
          disabled={!selected || saving}
          onClick={handleContinue}
        >
          {saving ? 'Saving...' : 'Continue'}
        </Button>

        <p className="text-center text-xs text-muted">
          Your gender is stored securely and only used for matching.
        </p>
      </div>
    </Screen>
  );
}
