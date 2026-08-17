import type { Customer, CardTemplate, Template, Signature, HistoryRecord, GreetingType, Station } from '../../types/entities';

/** Postgres uses snake_case; the app's TS types use camelCase. These
 * mappers translate rows in both directions so the rest of the app never
 * has to think about the DB's column naming. */

export interface CustomerRow {
  id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  gender: Customer['gender'];
  email: string;
  company: string | null;
  position: string | null;
  title: string | null;
  language: string;
  status: string;
  birth_date: string | null;
  greeting_type: GreetingType;
  station: Station;
  gift_suggestion: string | null;
  gift_budget: number | null;
  ecard_sent: boolean;
  gift_given: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export function customerFromRow(r: CustomerRow): Customer {
  return {
    id: r.id,
    fullName: r.full_name,
    firstName: r.first_name,
    lastName: r.last_name,
    gender: r.gender,
    email: r.email,
    company: r.company ?? undefined,
    position: r.position ?? undefined,
    title: r.title ?? undefined,
    language: (r.language as Customer['language']) ?? 'vi',
    status: (r.status as Customer['status']) ?? 'active',
    birthDate: r.birth_date ?? undefined,
    greetingType: r.greeting_type,
    station: r.station,
    giftSuggestion: r.gift_suggestion ?? undefined,
    giftBudget: r.gift_budget ?? undefined,
    ecardSent: r.ecard_sent,
    giftGiven: r.gift_given,
    notes: r.notes ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  };
}

export function customerToRow(c: Partial<Customer>): Partial<CustomerRow> {
  const row: Partial<CustomerRow> = {};
  if (c.fullName !== undefined) row.full_name = c.fullName;
  if (c.firstName !== undefined) row.first_name = c.firstName;
  if (c.lastName !== undefined) row.last_name = c.lastName;
  if (c.gender !== undefined) row.gender = c.gender;
  if (c.email !== undefined) row.email = c.email;
  if (c.company !== undefined) row.company = c.company ?? null;
  if (c.position !== undefined) row.position = c.position ?? null;
  if (c.title !== undefined) row.title = c.title ?? null;
  if (c.language !== undefined) row.language = c.language;
  if (c.status !== undefined) row.status = c.status;
  if (c.birthDate !== undefined) row.birth_date = c.birthDate ?? null;
  if (c.greetingType !== undefined) row.greeting_type = c.greetingType;
  if (c.station !== undefined) row.station = c.station;
  if (c.giftSuggestion !== undefined) row.gift_suggestion = c.giftSuggestion ?? null;
  if (c.giftBudget !== undefined) row.gift_budget = c.giftBudget ?? null;
  if (c.ecardSent !== undefined) row.ecard_sent = c.ecardSent;
  if (c.giftGiven !== undefined) row.gift_given = c.giftGiven;
  if (c.notes !== undefined) row.notes = c.notes ?? null;
  return row;
}

export interface CardTemplateRow {
  id: string;
  name: string;
  gender: CardTemplate['gender'];
  image_path: string;
  name_position: CardTemplate['namePosition'];
  font: CardTemplate['font'];
  message_box: CardTemplate['messageBox'] | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export function cardTemplateFromRow(r: CardTemplateRow): CardTemplate & { imagePath: string } {
  return {
    id: r.id,
    name: r.name,
    gender: r.gender,
    imagePath: r.image_path,
    namePosition: r.name_position,
    font: r.font,
    messageBox: r.message_box ?? undefined,
    isDefault: r.is_default,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  };
}

export interface TemplateRow {
  id: string;
  name: string;
  category: Template['category'];
  current_version: number;
  versions: Template['versions'];
  signature_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export function templateFromRow(r: TemplateRow): Template {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    currentVersion: r.current_version,
    versions: r.versions,
    signatureId: r.signature_id ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  };
}

export interface SignatureRow {
  id: string;
  name: string;
  html_content: string;
  is_default: boolean;
  version_number: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export function signatureFromRow(r: SignatureRow): Signature {
  return {
    id: r.id,
    name: r.name,
    htmlContent: r.html_content,
    isDefault: r.is_default,
    versionNumber: r.version_number,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  };
}

export interface HistoryRow {
  id: string;
  type: HistoryRecord['type'];
  customer_id: string | null;
  customer_name: string;
  gender: HistoryRecord['gender'];
  language: string;
  template_id: string | null;
  generated_content: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export function historyFromRow(r: HistoryRow): HistoryRecord {
  return {
    id: r.id,
    type: r.type,
    customerId: r.customer_id ?? '',
    customerName: r.customer_name,
    gender: r.gender,
    language: r.language as HistoryRecord['language'],
    templateId: r.template_id ?? '',
    generatedContent: r.generated_content ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  };
}
