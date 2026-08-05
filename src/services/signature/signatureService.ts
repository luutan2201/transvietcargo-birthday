import { signatureRepository } from '../../data/repositories/SignatureRepository';

export const signatureService = {
  list: () => signatureRepository.getAll({ pageSize: 5 }),
  getDefault: () => signatureRepository.getDefault(),
  setDefault: (id: string) => signatureRepository.setDefault(id),
  remove: (id: string) => signatureRepository.softDelete(id),

  async upload(name: string, htmlContent: string) {
    const { total } = await signatureRepository.getAll();
    return signatureRepository.create({
      name,
      htmlContent,
      isDefault: total === 0, // first signature becomes default automatically
      versionNumber: 1,
    });
  },

  rename: (id: string, name: string) => signatureRepository.update(id, { name }),
};
