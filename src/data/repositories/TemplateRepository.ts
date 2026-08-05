import { supabase } from '../../lib/supabaseClient';
import { templateFromRow, type TemplateRow } from '../supabase/rowMappers';
import type { Template, TemplateCategory } from '../../types/entities';
import { NotFoundError, RepositoryError } from '../errors';
import type { PagedResult, QueryOptions } from './IRepository';

const TABLE = 'templates';

export class TemplateRepository {
  async getById(id: string): Promise<Template | undefined> {
    const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle();
    if (error) throw new RepositoryError('Failed to fetch template', error);
    return data ? templateFromRow(data as TemplateRow) : undefined;
  }

  async getAll(options: QueryOptions = {}): Promise<PagedResult<Template>> {
    const { includeDeleted = false } = options;
    let query = supabase.from(TABLE).select('*', { count: 'exact' }).order('created_at', { ascending: false });
    if (!includeDeleted) query = query.is('deleted_at', null);
    const { data, error, count } = await query;
    if (error) throw new RepositoryError('Failed to list templates', error);
    return { items: (data as TemplateRow[]).map(templateFromRow), total: count ?? 0, page: 1, pageSize: count ?? 0 };
  }

  async findByCategory(category: TemplateCategory): Promise<Template[]> {
    const { data, error } = await supabase.from(TABLE).select('*').eq('category', category).is('deleted_at', null);
    if (error) throw new RepositoryError('Failed to filter templates', error);
    return (data as TemplateRow[]).map(templateFromRow);
  }

  async create(entity: Omit<Template, 'id' | 'createdAt' | 'updatedAt'>): Promise<Template> {
    const { data, error } = await supabase
      .from(TABLE)
      .insert({ name: entity.name, category: entity.category, current_version: entity.currentVersion, versions: entity.versions, signature_id: entity.signatureId ?? null })
      .select()
      .single();
    if (error) throw new RepositoryError('Failed to create template', error);
    return templateFromRow(data as TemplateRow);
  }

  async update(id: string, patch: Partial<Template>): Promise<Template> {
    const row: Record<string, unknown> = {};
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.category !== undefined) row.category = patch.category;
    if (patch.currentVersion !== undefined) row.current_version = patch.currentVersion;
    if (patch.versions !== undefined) row.versions = patch.versions;
    if (patch.signatureId !== undefined) row.signature_id = patch.signatureId ?? null;

    const { data, error } = await supabase.from(TABLE).update(row).eq('id', id).select().maybeSingle();
    if (error) throw new RepositoryError('Failed to update template', error);
    if (!data) throw new NotFoundError('Template', id);
    return templateFromRow(data as TemplateRow);
  }

  async softDelete(id: string): Promise<void> {
    const { error } = await supabase.from(TABLE).update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) throw new RepositoryError('Failed to delete template', error);
  }
}

export const templateRepository = new TemplateRepository();
