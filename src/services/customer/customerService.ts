import { customerRepository, type CustomerFilters } from '../../data/repositories/CustomerRepository';
import { giftPhotoRepository } from '../../data/repositories/GiftPhotoRepository';
import type { Customer, GreetingType, Station } from '../../types/entities';
import { ValidationError } from '../../data/errors';
import { createLogger } from '../../utils/logger';

const logger = createLogger('CustomerService');

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[parts.length - 1], lastName: parts.slice(0, -1).join(' ') };
}

/** "Which year" defaults to the REAL current calendar year everywhere
 * (Dashboard, Calendar, Email/Card Generator) unless a caller explicitly
 * asks for a different one — there is no separate "active year" toggle
 * that could silently switch what everyone sees. The Customers page is
 * the one place with an explicit year filter, letting an admin browse an
 * old year or prep next year's list early (e.g. import 2027 data in
 * December 2026) without changing what the rest of the app shows by
 * default while today is still in 2026. */
export function currentRealYear(): number {
  return new Date().getFullYear();
}

export const customerService = {
  listYears: () => customerRepository.listYears(),

  list: (options?: Parameters<typeof customerRepository.getAll>[0]) =>
    customerRepository.getAll({ ...options, year: options?.year ?? currentRealYear() }),

  search: (term: string, year: number = currentRealYear()) => customerRepository.search(term, year),

  filter: (filters: CustomerFilters) =>
    customerRepository.findByFilters({ ...filters, year: filters.year ?? currentRealYear() }),

  getById: (id: string) => customerRepository.getById(id),

  /** Convenience helper for "who has a birthday in month X" (1-12), for
   * the given year (defaults to the real current year). */
  listByBirthMonth: (birthMonth: number, year?: number) => customerService.filter({ birthMonth, year }),

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
    giftLink?: string;
    pic?: string;
    year?: number;
  }) {
    const year = input.year ?? currentRealYear();
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
      giftLink: input.greetingType === 'gift_visit' ? input.giftLink : undefined,
      pic: input.pic,
      ecardSent: false,
      giftGiven: false,
    });
  },

  update: (id: string, patch: Partial<Customer>) => customerRepository.update(id, patch),
  softDelete: (id: string) => customerRepository.softDelete(id),

  toggleEcardSent: (id: string, value: boolean) => customerRepository.update(id, { ecardSent: value }),
  toggleGiftGiven: (id: string, value: boolean) => customerRepository.update(id, { giftGiven: value }),

  /** Bulk-imports rows from the Excel/CSV parser into the given year's
   * list (defaults to the real current year). Within that year, a
   * matching email is updated in place; a different year always creates
   * a fresh row — this is what gives each year an independent,
   * from-scratch roster even for repeat customers. */
  async importRows(rows: Array<import('../../utils/excelImport').ImportRow>, year: number = currentRealYear()) {
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
          giftLink: greetingType === 'gift_visit' ? (row.giftLink ?? existing.giftLink) : undefined,
          pic: row.pic ?? existing.pic,
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
        giftLink: greetingType === 'gift_visit' ? row.giftLink : undefined,
        pic: row.pic,
        ecardSent: false,
        giftGiven: false,
      });
      results.imported++;
    }
    logger.info('Import finished', { year, ...results });
    return results;
  },
};
