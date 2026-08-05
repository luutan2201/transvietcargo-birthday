import { templateRepository } from '../../data/repositories/TemplateRepository';
import type { Template, TemplateCategory, TemplateVersion } from '../../types/entities';

export const templateService = {
  list: () => templateRepository.getAll({ pageSize: 500 }),
  listByCategory: (category: TemplateCategory) => templateRepository.findByCategory(category),
  getById: (id: string) => templateRepository.getById(id),
  remove: (id: string) => templateRepository.softDelete(id),

  async create(input: { name: string; category: TemplateCategory }) {
    const initialVersion: TemplateVersion = {
      versionNumber: 1,
      createdAt: new Date().toISOString(),
      status: 'draft',
      subjectVi: '',
      subjectEn: '',
      bodyVi: '',
      bodyEn: '',
    };
    return templateRepository.create({
      name: input.name,
      category: input.category,
      currentVersion: 1,
      versions: [initialVersion],
    });
  },

  /** Saves edits as a NEW draft version, preserving prior versions for history/rollback. */
  async saveNewVersion(templateId: string, edits: Partial<Omit<TemplateVersion, 'versionNumber' | 'createdAt'>>) {
    const template = await templateRepository.getById(templateId);
    if (!template) throw new Error('Template not found');
    const latest = template.versions[template.versions.length - 1];
    const newVersion: TemplateVersion = {
      ...latest,
      ...edits,
      versionNumber: latest.versionNumber + 1,
      createdAt: new Date().toISOString(),
      status: 'draft',
    };
    const versions = [...template.versions, newVersion];
    return templateRepository.update(templateId, { versions, currentVersion: newVersion.versionNumber });
  },

  async publishVersion(templateId: string, versionNumber: number) {
    const template = await templateRepository.getById(templateId);
    if (!template) throw new Error('Template not found');
    const versions = template.versions.map((v) => (v.versionNumber === versionNumber ? { ...v, status: 'published' as const } : v));
    return templateRepository.update(templateId, { versions, currentVersion: versionNumber });
  },

  getCurrentVersion(template: Template): TemplateVersion {
    return template.versions.find((v) => v.versionNumber === template.currentVersion) ?? template.versions[template.versions.length - 1];
  },

  setSignature: (templateId: string, signatureId: string) => templateRepository.update(templateId, { signatureId }),
};
