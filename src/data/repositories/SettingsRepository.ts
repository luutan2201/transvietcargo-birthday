import { supabase } from '../../lib/supabaseClient';
import { RepositoryError } from '../errors';

const TABLE = 'settings';

interface SettingsRow {
  id: string;
  key: string;
  value: unknown;
}

export class SettingsRepository {
  async getByKey(key: string): Promise<{ value: unknown } | undefined> {
    const { data, error } = await supabase.from(TABLE).select('*').eq('key', key).maybeSingle();
    if (error) throw new RepositoryError('Failed to fetch setting', error);
    return data ? { value: (data as SettingsRow).value } : undefined;
  }

  async setByKey(key: string, value: unknown): Promise<void> {
    const { error } = await supabase.from(TABLE).upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) throw new RepositoryError('Failed to save setting', error);
  }
}

export const settingsRepository = new SettingsRepository();
