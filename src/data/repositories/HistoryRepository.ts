import { supabase } from '../../lib/supabaseClient';
import { historyFromRow, type HistoryRow } from '../supabase/rowMappers';
import type { HistoryRecord } from '../../types/entities';
import { RepositoryError } from '../errors';

const TABLE = 'history';

class BaseHistoryRepository {
  private readonly type: HistoryRecord['type'];
  constructor(type: HistoryRecord['type']) {
    this.type = type;
  }

  async create(entity: Omit<HistoryRecord, 'id' | 'createdAt' | 'updatedAt' | 'type'>): Promise<HistoryRecord> {
    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        type: this.type,
        customer_id: entity.customerId || null,
        customer_name: entity.customerName,
        gender: entity.gender,
        language: entity.language,
        template_id: entity.templateId || null,
        generated_content: entity.generatedContent ?? null,
      })
      .select()
      .single();
    if (error) throw new RepositoryError(`Failed to record ${this.type} history`, error);
    return historyFromRow(data as HistoryRow);
  }

  async listByType(): Promise<HistoryRecord[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('type', this.type)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw new RepositoryError('Failed to list history', error);
    return (data as HistoryRow[]).map(historyFromRow);
  }

  async listByCustomer(customerId: string): Promise<HistoryRecord[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('type', this.type)
      .eq('customer_id', customerId)
      .is('deleted_at', null);
    if (error) throw new RepositoryError('Failed to list customer history', error);
    return (data as HistoryRow[]).map(historyFromRow);
  }

  async softDelete(id: string): Promise<void> {
    const { error } = await supabase.from(TABLE).update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) throw new RepositoryError('Failed to delete history record', error);
  }
}

export class GeneratedEmailRepository extends BaseHistoryRepository {
  constructor() {
    super('email');
  }
}

export class GeneratedCardRepository extends BaseHistoryRepository {
  constructor() {
    super('card');
  }
}

export const generatedEmailRepository = new GeneratedEmailRepository();
export const generatedCardRepository = new GeneratedCardRepository();

export async function listAllHistory(): Promise<HistoryRecord[]> {
  const { data, error } = await supabase.from(TABLE).select('*').is('deleted_at', null).order('created_at', { ascending: false });
  if (error) throw new RepositoryError('Failed to list history', error);
  return (data as HistoryRow[]).map(historyFromRow);
}
