import { supabase } from '../../lib/supabaseClient';
import { signatureFromRow, type SignatureRow } from '../supabase/rowMappers';
import type { Signature } from '../../types/entities';
import { RepositoryError, ValidationError } from '../errors';
import { MAX_SIGNATURE_VERSIONS } from '../../config/constants';
import type { PagedResult, QueryOptions } from './IRepository';

const TABLE = 'signatures';

export class SignatureRepository {
  async getAll(options: QueryOptions = {}): Promise<PagedResult<Signature>> {
    const { includeDeleted = false } = options;
    let query = supabase.from(TABLE).select('*', { count: 'exact' }).order('created_at', { ascending: true });
    if (!includeDeleted) query = query.is('deleted_at', null);
    const { data, error, count } = await query;
    if (error) throw new RepositoryError('Failed to list signatures', error);
    return { items: (data as SignatureRow[]).map(signatureFromRow), total: count ?? 0, page: 1, pageSize: count ?? 0 };
  }

  async create(entity: Omit<Signature, 'id' | 'createdAt' | 'updatedAt'>): Promise<Signature> {
    const { count } = await supabase.from(TABLE).select('*', { count: 'exact', head: true }).is('deleted_at', null);
    if ((count ?? 0) >= MAX_SIGNATURE_VERSIONS) {
      throw new ValidationError(`Maximum of ${MAX_SIGNATURE_VERSIONS} signature versions allowed`);
    }
    const { data, error } = await supabase
      .from(TABLE)
      .insert({ name: entity.name, html_content: entity.htmlContent, is_default: entity.isDefault, version_number: entity.versionNumber })
      .select()
      .single();
    if (error) throw new RepositoryError('Failed to create signature', error);
    return signatureFromRow(data as SignatureRow);
  }

  async getDefault(): Promise<Signature | undefined> {
    const { data, error } = await supabase.from(TABLE).select('*').eq('is_default', true).is('deleted_at', null).maybeSingle();
    if (error) throw new RepositoryError('Failed to fetch default signature', error);
    return data ? signatureFromRow(data as SignatureRow) : undefined;
  }

  async setDefault(id: string): Promise<void> {
    const { error: clearError } = await supabase.from(TABLE).update({ is_default: false }).eq('is_default', true);
    if (clearError) throw new RepositoryError('Failed to clear previous default signature', clearError);
    const { error } = await supabase.from(TABLE).update({ is_default: true }).eq('id', id);
    if (error) throw new RepositoryError('Failed to set default signature', error);
  }

  async softDelete(id: string): Promise<void> {
    const { error } = await supabase.from(TABLE).update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) throw new RepositoryError('Failed to delete signature', error);
  }

  async update(id: string, patch: Partial<Pick<Signature, 'name' | 'htmlContent'>>): Promise<Signature> {
    const row: Record<string, unknown> = {};
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.htmlContent !== undefined) row.html_content = patch.htmlContent;
    const { data, error } = await supabase.from(TABLE).update(row).eq('id', id).select().single();
    if (error) throw new RepositoryError('Failed to update signature', error);
    return signatureFromRow(data as SignatureRow);
  }
}

export const signatureRepository = new SignatureRepository();
