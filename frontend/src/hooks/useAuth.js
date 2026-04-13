import { useState, useEffect, useCallback } from 'react';
import { api, setToken } from '../services/api.js';

export function useAuth() {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const login = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const tg = window?.Telegram?.WebApp;
      if (!tg) throw new Error('Not running inside Telegram');

      tg.ready();
      tg.expand();

      const initData = tg.initData;
      if (!initData) throw new Error('No initData from Telegram');

      const data = await api.login(initData);

      if (data.error) throw new Error(data.error);

      setToken(data.token);
      setUser(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const data = await api.getMe();
      if (!data.error) setUser(data);
    } catch {}
  }, []);

  const updateGender = useCallback(async (gender) => {
    const data = await api.setGender(gender);
    if (!data.error) setUser(prev => ({ ...prev, gender }));
    return data;
  }, []);

  useEffect(() => { login(); }, [login]);

  return { user, loading, error, refreshUser, updateGender, setUser };
}
