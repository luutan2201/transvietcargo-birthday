import { settingsRepository } from '../../data/repositories/SettingsRepository';

export interface AppSettings {
  theme: 'light' | 'dark';
  defaultLanguage: 'vi' | 'en';
  historyRetentionMonths: number;
  logoDataUrl: string | null;
  /** Which year's customer list is currently the "live" working set —
   * every page (Customers, Dashboard, Calendar, Email/Card Generator)
   * only shows/creates customers tagged with this year. Advancing it via
   * "Bắt đầu năm mới" gives a clean slate without deleting old years. */
  activeYear: number;
}

const DEFAULTS: AppSettings = {
  theme: 'light',
  defaultLanguage: 'vi',
  historyRetentionMonths: 12,
  logoDataUrl: null,
  activeYear: new Date().getFullYear(),
};

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
