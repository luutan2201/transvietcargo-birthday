import { supabase } from '../../lib/supabaseClient';
import type { Profile, UserRole } from '../../types/entities';
import { ValidationError } from '../../data/errors';
import { createLogger } from '../../utils/logger';

const logger = createLogger('AuthService');

interface ProfileRow {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
  created_at: string;
}

function profileFromRow(r: ProfileRow): Profile {
  return { id: r.id, email: r.email, displayName: r.display_name, role: r.role, createdAt: r.created_at };
}

export const authService = {
  async login(email: string, password: string): Promise<Profile> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      logger.error('Supabase login error', error);
      throw new ValidationError(error.message || 'Invalid email or password');
    }
    if (!data.user) throw new ValidationError('Invalid email or password');

    try {
      const profile = await authService.getProfileOrThrow(data.user.id);
      logger.info('User logged in', { email });
      return profile;
    } catch (err) {
      await supabase.auth.signOut();
      throw err;
    }
  },

  async logout(): Promise<void> {
    await supabase.auth.signOut();
  },

  async getProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (error) {
      logger.error('Failed to fetch profile (likely an RLS/permissions issue)', error);
      return null;
    }
    if (!data) return null;
    return profileFromRow(data as ProfileRow);
  },

  /** Same as getProfile but throws with the real Supabase error message
   * instead of swallowing it — used right after login so failures are
   * diagnosable instead of showing a generic "no profile" message. */
  async getProfileOrThrow(userId: string): Promise<Profile> {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (error) throw new ValidationError(`Profile lookup failed: ${error.message}`);
    if (!data) throw new ValidationError('Your account has no profile set up — contact an admin.');
    return profileFromRow(data as ProfileRow);
  },

  /** Returns the current session's profile, or null if not logged in. */
  async getCurrentProfile(): Promise<Profile | null> {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) return null;
    return authService.getProfile(userId);
  },

  /** Admin-only: creates a login for a new team member via the
   * `create-user` Edge Function (which holds the service role key server
   * side — this can never be done safely from browser code directly). */
  async createUser(input: { email: string; password: string; displayName: string; role: UserRole }): Promise<void> {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new ValidationError('Not authenticated');

    const { data, error } = await supabase.functions.invoke('create-user', {
      body: input,
      headers: { Authorization: `Bearer ${token}` },
    });
    if (error) throw new ValidationError(error.message ?? 'Failed to create user');
    if (data?.error) throw new ValidationError(data.error);
  },

  async listProfiles(): Promise<Profile[]> {
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: true });
    if (error) throw new ValidationError(error.message);
    return (data as ProfileRow[]).map(profileFromRow);
  },

  async updateRole(userId: string, role: UserRole): Promise<void> {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
    if (error) throw new ValidationError(error.message);
  },
};
