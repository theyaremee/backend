import { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { Card, Button, Screen, BottomNav, Spinner, Badge } from '../components/index.js';

export default function TaskScreen({ user, onTokensUpdated, onNavigate }) {
  const [tasks, setTasks]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(null);
  const [toast, setToast]     = useState(null);

  useEffect(() => {
    api.getTasks().then(data => {
      if (!data.error) setTasks(data.tasks);
      setLoading(false);
    });
  }, []);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleClaim(task) {
    if (task.completed || !task.is_active || claiming) return;

    // Open action URL first for follow tasks
    if (task.action_url && (task.type === 'telegram_follow' || task.type === 'x_follow')) {
      window.Telegram?.WebApp?.openLink(task.action_url);
    }

    setClaiming(task.id);
    const data = await api.claimTask(task.id);
    setClaiming(null);

    if (data.error === 'task_already_completed') {
      showToast('Already completed', 'warn');
    } else if (data.error) {
      showToast('Could not claim reward', 'error');
    } else {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: true } : t));
      onTokensUpdated?.(data.new_balance);
      showToast(`+${data.awarded} token${data.awarded !== 1 ? 's' : ''} earned!`);
    }
  }

  const typeIcon = {
    telegram_follow: '📣',
    x_follow:        '🐦',
    watch_ad:        '📺'
  };

  return (
    <Screen>
      <div className="flex flex-col flex-1 px-5 pt-8 pb-24">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold">Tasks</h1>
          <p className="text-muted text-sm mt-1">Complete tasks to earn Gender Tokens</p>
        </div>

        {/* Token balance */}
        <Card className="mb-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-vip/20 flex items-center justify-center text-2xl">🪙</div>
          <div>
            <div className="text-2xl font-bold">{user.token_balance}</div>
            <div className="text-muted text-xs">Gender Tokens</div>
          </div>
          <div className="ml-auto text-xs text-muted">max 50</div>
        </Card>

        {/* Token explanation */}
        <div className="bg-white/5 rounded-xl p-4 mb-6 text-xs text-muted leading-relaxed">
          🎯 <span className="text-white">What are tokens?</span> Each token lets you choose who to match with (male or female) for one call — even as a free user.
        </div>

        {/* Task list */}
        {loading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : (
          <div className="flex flex-col gap-3">
            {tasks.map(task => (
              <Card key={task.id} className={`flex items-center gap-4 ${!task.is_active ? 'opacity-60' : ''}`}>
                <div className="w-12 h-12 rounded-xl bg-card flex items-center justify-center text-2xl flex-shrink-0">
                  {typeIcon[task.type] || '📋'}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{task.label}</div>
                  <div className="text-muted text-xs mt-0.5">
                    {task.is_active ? `+${task.reward_tokens} token${task.reward_tokens !== 1 ? 's' : ''}` : 'Coming soon'}
                  </div>
                </div>

                <div className="flex-shrink-0">
                  {task.completed ? (
                    <Badge variant="success">Done ✓</Badge>
                  ) : !task.is_active ? (
                    <Badge variant="default">Soon</Badge>
                  ) : (
                    <button
                      onClick={() => handleClaim(task)}
                      disabled={!!claiming}
                      className="px-4 py-2 rounded-xl bg-white text-black text-xs font-medium active:scale-95 transition-all disabled:opacity-50"
                    >
                      {claiming === task.id ? '...' : task.type === 'telegram_follow' || task.type === 'x_follow' ? 'Follow & Claim' : 'Claim'}
                    </button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-sm font-medium shadow-lg animate-fade-in ${
          toast.type === 'success' ? 'bg-success text-white' :
          toast.type === 'warn'    ? 'bg-warning text-black' :
                                     'bg-danger text-white'
        }`}>
          {toast.msg}
        </div>
      )}

      <BottomNav active="tasks" onNavigate={onNavigate} />
    </Screen>
  );
}
