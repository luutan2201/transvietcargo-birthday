import { cardTemplateRepository, type CardTemplateWithPath } from '../../data/repositories/CardTemplateRepository';
import type { CardTemplate } from '../../types/entities';

export interface SaveCardTemplateInput {
  name: string;
  gender: CardTemplate['gender'];
  file: File; // PNG
  namePosition: CardTemplate['namePosition'];
  font: CardTemplate['font'];
  messageBox?: CardTemplate['messageBox'];
  isDefault?: boolean;
}

export const cardTemplateService = {
  list: () => cardTemplateRepository.getAll({ pageSize: 500 }),
  listByGender: (gender: CardTemplate['gender']) => cardTemplateRepository.findByGender(gender),
  getById: (id: string) => cardTemplateRepository.getById(id),
  remove: (id: string) => cardTemplateRepository.softDelete(id),

  /** Card images live in public Supabase Storage — the URL is available
   * synchronously, no fetch/blob conversion needed like the old IndexedDB
   * version required. */
  getImageUrl(template: CardTemplateWithPath): Promise<string> {
    return Promise.resolve(cardTemplateRepository.getPublicUrl(template.imagePath));
  },

  async save(input: SaveCardTemplateInput): Promise<CardTemplateWithPath> {
    const imagePath = await cardTemplateRepository.uploadImage(input.file);
    return cardTemplateRepository.create({
      name: input.name,
      gender: input.gender,
      imagePath,
      namePosition: input.namePosition,
      font: input.font,
      messageBox: input.messageBox,
      isDefault: input.isDefault ?? false,
    });
  },

  async update(id: string, patch: Partial<Pick<CardTemplate, 'name' | 'namePosition' | 'font' | 'messageBox' | 'isDefault'>>, newFile?: File) {
    const newImagePath = newFile ? await cardTemplateRepository.uploadImage(newFile) : undefined;
    return cardTemplateRepository.update(id, patch, newImagePath);
  },
};
