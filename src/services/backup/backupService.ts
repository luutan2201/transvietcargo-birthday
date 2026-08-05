import { supabase } from '../../lib/supabaseClient';
import { createLogger } from '../../utils/logger';

const BACKUP_TABLES = ['customers', 'templates', 'signatures', 'history', 'settings', 'card_templates'] as const;
const logger = createLogger('BackupService');

export const backupService = {
  /** Exports all core tables to a single downloadable JSON file. Note: card
   * template background images live in Storage and are NOT included here
   * — only the row metadata (position/font/image path) is backed up. */
  async exportJson(): Promise<{ blob: Blob; fileName: string }> {
    const payload: Record<string, unknown> = { exportedAt: new Date().toISOString(), version: 2, data: {} };
    const counts: Record<string, number> = {};

    for (const table of BACKUP_TABLES) {
      const { data, error } = await supabase.from(table).select('*');
      if (error) throw error;
      (payload.data as Record<string, unknown>)[table] = data;
      counts[table] = data?.length ?? 0;
    }

    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const fileName = `transviet-backup-${new Date().toISOString().slice(0, 10)}.json`;

    logger.info('Backup exported', counts);
    return { blob, fileName };
  },

  /** Restores all core tables from a previously exported JSON file (upsert
   * by id — existing rows are overwritten, nothing is deleted). */
  async restoreFromJson(file: File): Promise<Record<string, number>> {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!parsed?.data) throw new Error('Invalid backup file format');

    const counts: Record<string, number> = {};
    for (const table of BACKUP_TABLES) {
      const records = parsed.data[table] ?? [];
      if (records.length) {
        const { error } = await supabase.from(table).upsert(records, { onConflict: 'id' });
        if (error) throw error;
      }
      counts[table] = records.length;
    }
    logger.info('Backup restored', counts);
    return counts;
  },
};
