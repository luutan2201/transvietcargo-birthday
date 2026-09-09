import { signatureRepository } from '../../data/repositories/SignatureRepository';
import type { Signature } from '../../types/entities';

export interface SaveSignatureInput {
  name: string;
  htmlContent: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  isDefault?: boolean;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export const signatureService = {
  list: () => signatureRepository.getAll({ pageSize: 5 }),
  getDefault: () => signatureRepository.getDefault(),
  setDefault: (id: string) => signatureRepository.setDefault(id),
  remove: (id: string) => signatureRepository.softDelete(id),
  rename: (id: string, name: string) => signatureRepository.update(id, { name }),

  /** Resolves which signature to actually use: a scheduled signature
   * (e.g. Tết) whose date range covers today takes priority over the
   * manually-set default — this is what powers automatic holiday
   * signature switching. Falls back to the default, then the first
   * signature, if nothing is scheduled. */
  async getEffectiveSignature(): Promise<Signature | undefined> {
    const { items } = await signatureRepository.getAll();
    const today = todayIso();
    const scheduled = items
      .filter((s) => s.effectiveFrom && s.effectiveTo && s.effectiveFrom <= today && today <= s.effectiveTo)
      // if multiple overlap, prefer the one with the narrowest (most specific) window
      .sort((a, b) => (a.effectiveTo! < b.effectiveTo! ? -1 : 1))[0];
    if (scheduled) return scheduled;
    return items.find((s) => s.isDefault) ?? items[0];
  },

  async save(input: SaveSignatureInput) {
    const { total } = await signatureRepository.getAll();
    return signatureRepository.create({
      name: input.name,
      htmlContent: input.htmlContent,
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo,
      isDefault: input.isDefault ?? total === 0, // first signature becomes default automatically
      versionNumber: 1,
    });
  },

  async update(id: string, input: SaveSignatureInput) {
    return signatureRepository.update(id, {
      name: input.name,
      htmlContent: input.htmlContent,
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo,
    });
  },
};
