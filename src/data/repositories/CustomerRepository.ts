import { supabase } from '../../lib/supabaseClient';
import { customerFromRow, customerToRow, type CustomerRow } from '../supabase/rowMappers';
import type { Customer, GreetingType, Station } from '../../types/entities';
import { NotFoundError, RepositoryError } from '../errors';
import type { PagedResult, QueryOptions } from './IRepository';

export interface CustomerFilters {
  birthMonth?: number; // 1-12
  station?: Station;
  greetingType?: GreetingType;
  pendingOnly?: boolean;
}

const TABLE = 'customers';

export class CustomerRepository {
  async getById(id: string): Promise<Customer | undefined> {
    const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle();
    if (error) throw new RepositoryError('Failed to fetch customer', error);
    return data ? customerFromRow(data as CustomerRow) : undefined;
  }

  async getAll(options: QueryOptions = {}): Promise<PagedResult<Customer>> {
    const { page = 1, pageSize = 1000, sortBy, sortDir = 'asc', includeDeleted = false } = options;
    let query = supabase.from(TABLE).select('*', { count: 'exact' });
    if (!includeDeleted) query = query.is('deleted_at', null);
    if (sortBy) query = query.order(toSnakeCase(sortBy), { ascending: sortDir === 'asc' });
    query = query.range((page - 1) * pageSize, page * pageSize - 1);

    const { data, error, count } = await query;
    if (error) throw new RepositoryError('Failed to list customers', error);
    return { items: (data as CustomerRow[]).map(customerFromRow), total: count ?? 0, page, pageSize };
  }

  async create(entity: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>): Promise<Customer> {
    const { data, error } = await supabase.from(TABLE).insert(customerToRow(entity)).select().single();
    if (error) throw new RepositoryError('Failed to create customer', error);
    return customerFromRow(data as CustomerRow);
  }

  async update(id: string, patch: Partial<Customer>): Promise<Customer> {
    const { data, error } = await supabase.from(TABLE).update(customerToRow(patch)).eq('id', id).select().maybeSingle();
    if (error) throw new RepositoryError('Failed to update customer', error);
    if (!data) throw new NotFoundError('Customer', id);
    return customerFromRow(data as CustomerRow);
  }

  async softDelete(id: string): Promise<void> {
    const { error } = await supabase.from(TABLE).update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) throw new RepositoryError('Failed to delete customer', error);
  }

  async count(options: Pick<QueryOptions, 'includeDeleted'> = {}): Promise<number> {
    let query = supabase.from(TABLE).select('*', { count: 'exact', head: true });
    if (!options.includeDeleted) query = query.is('deleted_at', null);
    const { count, error } = await query;
    if (error) throw new RepositoryError('Failed to count customers', error);
    return count ?? 0;
  }

  async findByEmail(email: string): Promise<Customer | undefined> {
    const { data, error } = await supabase.from(TABLE).select('*').ilike('email', email).is('deleted_at', null).maybeSingle();
    if (error) throw new RepositoryError('Failed to look up customer by email', error);
    return data ? customerFromRow(data as CustomerRow) : undefined;
  }

  async search(term: string): Promise<Customer[]> {
    const q = term.trim();
    if (!q) {
      const { data, error } = await supabase.from(TABLE).select('*').is('deleted_at', null);
      if (error) throw new RepositoryError('Failed to search customers', error);
      return (data as CustomerRow[]).map(customerFromRow);
    }
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .is('deleted_at', null)
      .or(`full_name.ilike.%${q}%,email.ilike.%${q}%,company.ilike.%${q}%`);
    if (error) throw new RepositoryError('Failed to search customers', error);
    return (data as CustomerRow[]).map(customerFromRow);
  }

  /** Filters by birthday month, station, greeting type, and/or pending completion.
   * Month filtering happens client-side since Postgres date extraction across
   * a mix of real/placeholder years is simplest done after fetching. */
  async findByFilters(filters: CustomerFilters): Promise<Customer[]> {
    let query = supabase.from(TABLE).select('*').is('deleted_at', null);
    if (filters.station) query = query.eq('station', filters.station);
    if (filters.greetingType) query = query.eq('greeting_type', filters.greetingType);

    const { data, error } = await query;
    if (error) throw new RepositoryError('Failed to filter customers', error);
    let customers = (data as CustomerRow[]).map(customerFromRow);

    if (filters.birthMonth) {
      customers = customers.filter((c) => c.birthDate && Number(c.birthDate.split('-')[1]) === filters.birthMonth);
    }
    if (filters.pendingOnly) {
      customers = customers.filter((c) => !c.ecardSent || (c.greetingType === 'gift_visit' && !c.giftGiven));
    }
    return customers;
  }
}

function toSnakeCase(s: string): string {
  return s.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
}

export const customerRepository = new CustomerRepository();
