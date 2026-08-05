import { settingsRepository } from '../../data/repositories/SettingsRepository';

export interface AppSettings {
  theme: 'light' | 'dark';
  defaultLanguage: 'vi' | 'en';
  historyRetentionMonths: number;
  logoDataUrl: string | null;
}

const DEFAULTS: AppSettings = { theme: 'light', defaultLanguage: 'vi', historyRetentionMonths: 12, logoDataUrl: null };

export const settingsService = {
  async getAll(): Promise<AppSettings> {
    const entries = await Promise.all(
      (Object.keys(DEFAULTS) as Array<keyof AppSettings>).map(async (key) => {
        const record = await settingsRepository.getByKey(key);
        return [key, record ? record.value : DEFAULTS[key]] as const;
      })
    );
    return Object.fromEntries(entries) as unknown as AppSettings;
  },

  async set<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    await settingsRepository.setByKey(key, value);
  },
};
