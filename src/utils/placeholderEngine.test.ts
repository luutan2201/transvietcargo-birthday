import { describe, it, expect } from 'vitest';
import { buildPlaceholderMap, renderPlaceholders } from './placeholderEngine';
import type { Customer } from '../types/entities';

const customer: Customer = {
  id: '1', createdAt: '', updatedAt: '',
  fullName: 'Nguyễn Văn A', firstName: 'A', lastName: 'Nguyễn Văn',
  gender: 'male', email: 'a@transviet.com', company: 'TransViet', position: 'Manager',
  language: 'vi', status: 'active',
  greetingType: 'ecard_only', station: 'SGN', ecardSent: false, giftGiven: false,
};

describe('placeholderEngine', () => {
  it('replaces known placeholders and leaves unknown ones untouched', () => {
    const map = buildPlaceholderMap({ customer, language: 'vi' });
    const out = renderPlaceholders('Kính gửi {{PRONOUN}} {{FULL_NAME}}, mã: {{UNKNOWN_TOKEN}}', map);
    expect(out).toBe('Kính gửi Anh Nguyễn Văn A, mã: {{UNKNOWN_TOKEN}}');
  });

  it('uses gender+language to pick the right pronoun', () => {
    const female = { ...customer, gender: 'female' as const };
    const mapEn = buildPlaceholderMap({ customer: female, language: 'en' });
    expect(mapEn.PRONOUN).toBe('Ms.');
  });
});
