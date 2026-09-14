import { supabase } from '../../lib/supabaseClient';
import { giftPhotoFromRow, type GiftPhotoRow } from '../supabase/rowMappers';
import type { GiftPhoto } from '../../types/entities';
import { RepositoryError } from '../errors';

const TABLE = 'gift_photos';
const BUCKET = 'gift-photos';

export class GiftPhotoRepository {
  async listByCustomer(customerId: string): Promise<GiftPhoto[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('customer_id', customerId)
      .order('year', { ascending: false });
    if (error) throw new RepositoryError('Failed to list gift photos', error);
    return (data as GiftPhotoRow[]).map(giftPhotoFromRow);
  }

  async uploadImage(file: File): Promise<string> {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false, contentType: file.type || 'image/jpeg' });
    if (error) throw new RepositoryError(`Failed to upload gift photo: ${error.message}`, error);
    return path;
  }

  getPublicUrl(path: string): string {
    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }

  /** Looks up every gift photo belonging to the given customers — used to
   * clean up their Storage files BEFORE the customers are deleted.
   * Postgres cascade removes the gift_photos ROWS automatically when a
   * customer is deleted, but it has no knowledge of Supabase Storage, so
   * the actual image files would otherwise become orphaned dead weight. */
  async listByCustomerIds(customerIds: string[]): Promise<GiftPhoto[]> {
    if (customerIds.length === 0) return [];
    const { data, error } = await supabase.from(TABLE).select('*').in('customer_id', customerIds);
    if (error) throw new RepositoryError('Failed to look up gift photos for cleanup', error);
    return (data as GiftPhotoRow[]).map(giftPhotoFromRow);
  }

  async removeStorageObjects(paths: string[]): Promise<void> {
    if (paths.length === 0) return;
    const { error } = await supabase.storage.from(BUCKET).remove(paths);
    if (error) throw new RepositoryError('Failed to remove gift photo files from storage', error);
  }

  async create(customerId: string, year: number, imagePath: string): Promise<GiftPhoto> {
    const { data, error } = await supabase
      .from(TABLE)
      .insert({ customer_id: customerId, year, image_path: imagePath })
      .select()
      .single();
    if (error) throw new RepositoryError('Failed to save gift photo record', error);
    return giftPhotoFromRow(data as GiftPhotoRow);
  }

  async delete(id: string, imagePath: string): Promise<void> {
    await supabase.storage.from(BUCKET).remove([imagePath]);
    const { error } = await supabase.from(TABLE).delete().eq('id', id);
    if (error) throw new RepositoryError('Failed to delete gift photo', error);
  }
}

export const giftPhotoRepository = new GiftPhotoRepository();
