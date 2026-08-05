import { supabase } from '../../lib/supabaseClient';
import { cardTemplateFromRow, type CardTemplateRow } from '../supabase/rowMappers';
import type { CardTemplate } from '../../types/entities';
import { RepositoryError } from '../errors';
import type { PagedResult, QueryOptions } from './IRepository';

const TABLE = 'card_templates';
const BUCKET = 'card-templates';

export type CardTemplateWithPath = CardTemplate & { imagePath: string };

export class CardTemplateRepository {
  async getById(id: string): Promise<CardTemplateWithPath | undefined> {
    const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle();
    if (error) throw new RepositoryError('Failed to fetch card template', error);
    return data ? cardTemplateFromRow(data as CardTemplateRow) : undefined;
  }

  async getAll(options: QueryOptions = {}): Promise<PagedResult<CardTemplateWithPath>> {
    const { includeDeleted = false } = options;
    let query = supabase.from(TABLE).select('*', { count: 'exact' }).order('created_at', { ascending: true });
    if (!includeDeleted) query = query.is('deleted_at', null);
    const { data, error, count } = await query;
    if (error) throw new RepositoryError('Failed to list card templates', error);
    return { items: (data as CardTemplateRow[]).map(cardTemplateFromRow), total: count ?? 0, page: 1, pageSize: count ?? 0 };
  }

  async findByGender(gender: CardTemplate['gender']): Promise<CardTemplateWithPath[]> {
    const { data, error } = await supabase.from(TABLE).select('*').eq('gender', gender).is('deleted_at', null);
    if (error) throw new RepositoryError('Failed to filter card templates', error);
    return (data as CardTemplateRow[]).map(cardTemplateFromRow);
  }

  /** Uploads the background PNG to Supabase Storage and returns its path. */
  async uploadImage(file: File): Promise<string> {
    // Use a fully sanitized name (not the original filename) — storage
    // object keys can reject spaces, diacritics, and special characters
    // like parentheses, which are common in real-world uploaded filenames.
    const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false, contentType: file.type || 'image/png' });
    if (error) throw new RepositoryError(`Failed to upload card template image: ${error.message}`, error);
    return path;
  }

  getPublicUrl(path: string): string {
    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }

  async create(input: {
    name: string;
    gender: CardTemplate['gender'];
    imagePath: string;
    namePosition: CardTemplate['namePosition'];
    font: CardTemplate['font'];
    messageBox?: CardTemplate['messageBox'];
    isDefault: boolean;
  }): Promise<CardTemplateWithPath> {
    if (input.isDefault) await this.clearDefault(input.gender);
    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        name: input.name,
        gender: input.gender,
        image_path: input.imagePath,
        name_position: input.namePosition,
        font: input.font,
        message_box: input.messageBox ?? null,
        is_default: input.isDefault,
      })
      .select()
      .single();
    if (error) throw new RepositoryError('Failed to create card template', error);
    return cardTemplateFromRow(data as CardTemplateRow);
  }

  async update(
    id: string,
    patch: Partial<Pick<CardTemplate, 'name' | 'namePosition' | 'font' | 'messageBox' | 'isDefault'>>,
    newImagePath?: string
  ): Promise<CardTemplateWithPath> {
    if (patch.isDefault) {
      const existing = await this.getById(id);
      if (existing) await this.clearDefault(existing.gender);
    }
    const row: Record<string, unknown> = {};
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.namePosition !== undefined) row.name_position = patch.namePosition;
    if (patch.font !== undefined) row.font = patch.font;
    if (patch.messageBox !== undefined) row.message_box = patch.messageBox ?? null;
    if (patch.isDefault !== undefined) row.is_default = patch.isDefault;
    if (newImagePath) row.image_path = newImagePath;

    const { data, error } = await supabase.from(TABLE).update(row).eq('id', id).select().single();
    if (error) throw new RepositoryError('Failed to update card template', error);
    return cardTemplateFromRow(data as CardTemplateRow);
  }

  async softDelete(id: string): Promise<void> {
    const { error } = await supabase.from(TABLE).update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) throw new RepositoryError('Failed to delete card template', error);
  }

  private async clearDefault(gender: CardTemplate['gender']): Promise<void> {
    const { error } = await supabase.from(TABLE).update({ is_default: false }).eq('gender', gender).eq('is_default', true);
    if (error) throw new RepositoryError('Failed to clear previous default card template', error);
  }
}

export const cardTemplateRepository = new CardTemplateRepository();
