import { customerRepository, type CustomerFilters } from '../../data/repositories/CustomerRepository';
import { giftPhotoRepository } from '../../data/repositories/GiftPhotoRepository';
import { settingsService } from '../settings/settingsService';
import type { Customer, GreetingType, Station } from '../../types/entities';
import { ValidationError } from '../../data/errors';
import { createLogger } from '../../utils/logger';

const logger = createLogger('CustomerService');

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[parts.length - 1], lastName: parts.slice(0, -1).join(' ') };
}

/** Every method below is automatically scoped to the "active year" (see
 * settingsService.activeYear) — the whole app only ever sees/creates
 * customers belonging to the current working year's list. This is what
 * makes "mỗi năm 1 danh sách hoàn toàn mới" work: advancing the active
 * year with startNewYear() gives every page an empty slate without
 * deleting anything, and re-importing an Excel file populates that new
 * year fresh. Old years remain intact until explicitly wiped with
 * deleteYearData(). */
export const customerService = {
  getActiveYear: async () => (await settingsService.getAll()).activeYear,
  listYears: () => customerRepository.listYears(),

  async list(options?: Parameters<typeof customerRepository.getAll>[0]) {
    const year = options?.year ?? (await customerService.getActiveYear());
    return customerRepository.getAll({ ...options, year });
  },

  async search(term: string) {
    return customerRepository.search(term, await customerService.getActiveYear());
  },

  async filter(filters: CustomerFilters) {
    return customerRepository.findByFilters({ ...filters, year: filters.year ?? (await customerService.getActiveYear()) });
  },

  getById: (id: string) => customerRepository.getById(id),

  /** Convenience helper for "who has a birthday in month X" (1-12). */
  listByBirthMonth: (birthMonth: number) => customerService.filter({ birthMonth }),

  /** Advances the working year — does not delete or modify any existing
   * data. All list/create/import calls immediately start scoping to the
   * new year, which will appear empty until customers are imported into it. */
  async startNewYear(newYear: number) {
    await settingsService.set('activeYear', newYear);
    logger.info('Started new year', { newYear });
  },

  /** Permanently deletes every customer tagged with the given year, and
   * (since Postgres cascade only removes gift_photos ROWS, never the
   * actual Storage files) explicitly cleans up their gift photo files
   * first so nothing is left orphaned taking up storage. Irreversible. */
  async deleteYearData(year: number) {
    const { items: customersInYear } = await customerRepository.getAll({ year, includeDeleted: true, pageSize: 10000 });
    const customerIds = customersInYear.map((c) => c.id);

    const photos = await giftPhotoRepository.listByCustomerIds(customerIds);
    if (photos.length > 0) {
      await giftPhotoRepository.removeStorageObjects(photos.map((p) => p.imagePath));
    }

    const count = await customerRepository.deleteByYear(year);
    logger.warn('Deleted year data', { year, customers: count, photos: photos.length });
    return count;
  },

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
    const year = await customerService.getActiveYear();
    const existing = await customerRepository.findByEmail(input.email, year);
    if (existing) throw new ValidationError(`Email "${input.email}" already exists in the ${year} list`);
    const { firstName, lastName } = splitName(input.fullName);
    return customerRepository.create({
      year,
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

  /** Bulk-imports rows from the Excel/CSV parser into the CURRENT active
   * year's list. Within that year, a matching email is updated in place;
   * across years, importing the same email again always creates a fresh
   * row for the new year — this is what gives each year an independent,
   * from-scratch roster even for repeat customers. */
  async importRows(rows: Array<import('../../utils/excelImport').ImportRow>) {
    const year = await customerService.getActiveYear();
    const results = { imported: 0, updated: 0, skipped: 0, skippedEmails: [] as string[] };
    for (const row of rows) {
      const { firstName, lastName } = splitName(row.fullName);
      const greetingType = row.greetingType ?? 'ecard_only';
      const existing = await customerRepository.findByEmail(row.email, year);

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
        year,
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
    logger.info('Import finished', { year, ...results });
    return results;
  },
};
