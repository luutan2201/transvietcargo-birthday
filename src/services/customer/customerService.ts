import { customerRepository, type CustomerFilters } from '../../data/repositories/CustomerRepository';
import type { Customer, GreetingType, Station } from '../../types/entities';
import { ValidationError } from '../../data/errors';
import { createLogger } from '../../utils/logger';

const logger = createLogger('CustomerService');

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[parts.length - 1], lastName: parts.slice(0, -1).join(' ') };
}

export const customerService = {
  list: (options?: Parameters<typeof customerRepository.getAll>[0]) => customerRepository.getAll(options),
  search: (term: string) => customerRepository.search(term),
  filter: (filters: CustomerFilters) => customerRepository.findByFilters(filters),
  getById: (id: string) => customerRepository.getById(id),

  /** Convenience helper for "who has a birthday in month X" (1-12). */
  listByBirthMonth: (birthMonth: number) => customerRepository.findByFilters({ birthMonth }),

  async create(input: {
    fullName: string;
    gender: Customer['gender'];
    email: string;
    company?: string;
    position?: string;
    language?: Customer['language'];
    birthDate?: string;
    greetingType: GreetingType;
    station: Station;
    giftSuggestion?: string;
    giftBudget?: number;
  }) {
    const existing = await customerRepository.findByEmail(input.email);
    if (existing) throw new ValidationError(`Email "${input.email}" already exists`);
    const { firstName, lastName } = splitName(input.fullName);
    return customerRepository.create({
      fullName: input.fullName,
      firstName,
      lastName,
      gender: input.gender,
      email: input.email,
      company: input.company,
      position: input.position,
      language: input.language ?? 'vi',
      status: 'active',
      birthDate: input.birthDate,
      greetingType: input.greetingType,
      station: input.station,
      giftSuggestion: input.greetingType === 'gift_visit' ? input.giftSuggestion : undefined,
      giftBudget: input.greetingType === 'gift_visit' ? input.giftBudget : undefined,
      ecardSent: false,
      giftGiven: false,
    });
  },

  update: (id: string, patch: Partial<Customer>) => customerRepository.update(id, patch),
  softDelete: (id: string) => customerRepository.softDelete(id),

  toggleEcardSent: (id: string, value: boolean) => customerRepository.update(id, { ecardSent: value }),
  toggleGiftGiven: (id: string, value: boolean) => customerRepository.update(id, { giftGiven: value }),

  /** Bulk-imports rows from the Excel/CSV parser. If a customer with the
   * same email already exists, their record is UPDATED with the file's
   * data (birthDate, station, type, gift suggestion, etc.) instead of
   * being skipped — otherwise re-importing a corrected spreadsheet would
   * silently fail to fix customers created by an earlier, broken import. */
  async importRows(rows: Array<import('../../utils/excelImport').ImportRow>) {
    const results = { imported: 0, updated: 0, skipped: 0, skippedEmails: [] as string[] };
    for (const row of rows) {
      const { firstName, lastName } = splitName(row.fullName);
      const greetingType = row.greetingType ?? 'ecard_only';
      const existing = await customerRepository.findByEmail(row.email);

      if (existing) {
        await customerRepository.update(existing.id, {
          fullName: row.fullName,
          firstName,
          lastName,
          gender: row.gender,
          company: row.company,
          position: row.position,
          birthDate: row.birthDate ?? existing.birthDate,
          greetingType,
          station: row.station ?? existing.station,
          giftSuggestion: greetingType === 'gift_visit' ? (row.giftSuggestion ?? existing.giftSuggestion) : undefined,
          giftBudget: greetingType === 'gift_visit' ? (row.giftBudget ?? existing.giftBudget) : undefined,
        });
        results.updated++;
        continue;
      }

      await customerRepository.create({
        fullName: row.fullName,
        firstName,
        lastName,
        gender: row.gender,
        email: row.email,
        company: row.company,
        position: row.position,
        language: 'vi',
        status: 'active',
        birthDate: row.birthDate,
        greetingType,
        station: row.station ?? 'SGN',
        giftSuggestion: greetingType === 'gift_visit' ? row.giftSuggestion : undefined,
        giftBudget: greetingType === 'gift_visit' ? row.giftBudget : undefined,
        ecardSent: false,
        giftGiven: false,
      });
      results.imported++;
    }
    logger.info('Import finished', results);
    return results;
  },
};
