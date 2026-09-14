import { giftPhotoRepository } from '../../data/repositories/GiftPhotoRepository';
import { compressImage } from '../../utils/compressImage';
import type { GiftPhoto } from '../../types/entities';

export const giftPhotoService = {
  listByCustomer: (customerId: string) => giftPhotoRepository.listByCustomer(customerId),
  getImageUrl: (photo: GiftPhoto) => giftPhotoRepository.getPublicUrl(photo.imagePath),
  delete: (photo: GiftPhoto) => giftPhotoRepository.delete(photo.id, photo.imagePath),

  /** Compresses the photo client-side, uploads it, and records it under
   * the given year (should be the customer's own `year`, i.e. which
   * list they belong to — not necessarily today's calendar year). */
  async upload(customerId: string, file: File, year: number): Promise<GiftPhoto> {
    const compressed = await compressImage(file);
    const imagePath = await giftPhotoRepository.uploadImage(compressed);
    return giftPhotoRepository.create(customerId, year, imagePath);
  },
};
