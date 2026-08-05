import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { authService } from '../services/auth/authService';
import type { Profile } from '../types/entities';

export function useAuth() {
  const [session, setSession] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    authService.getCurrentProfile().then((p) => {
      setSession(p);
      setIsLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, authSession) => {
      if (!authSession) {
        setSession(null);
        return;
      }
      const profile = await authService.getProfile(authSession.user.id);
      setSession(profile);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const profile = await authService.login(email, password);
    setSession(profile);
    return profile;
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setSession(null);
  }, []);

  return { session, isLoading, login, logout };
}
