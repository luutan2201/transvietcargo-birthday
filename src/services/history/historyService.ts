import { generatedEmailRepository, generatedCardRepository } from '../../data/repositories/HistoryRepository';
import type { HistoryRecord } from '../../types/entities';

export const historyService = {
  async listAll(): Promise<HistoryRecord[]> {
    const [emails, cards] = await Promise.all([generatedEmailRepository.listByType(), generatedCardRepository.listByType()]);
    return [...emails, ...cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  listByCustomer: (customerId: string) => generatedEmailRepository.listByCustomer(customerId),

  /** Suggests cleanup when entering a new month, per 00_CLAUDE_INSTRUCTIONS.md §20. */
  async suggestsCleanup(): Promise<boolean> {
    const all = await this.listAll();
    if (all.length === 0) return false;
    const now = new Date();
    const oldestThisMonth = all.some((h) => {
      const d = new Date(h.createdAt);
      return d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear();
    });
    return oldestThisMonth;
  },

  async clearOlderThan(isoDate: string): Promise<number> {
    const all = await this.listAll();
    const toDelete = all.filter((h) => h.createdAt < isoDate);
    await Promise.all(toDelete.map((h) => (h.type === 'email' ? generatedEmailRepository : generatedCardRepository).softDelete(h.id)));
    return toDelete.length;
  },
};
