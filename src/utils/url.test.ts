import { describe, it, expect } from 'vitest';
import { normalizeExternalUrl } from './url';

describe('normalizeExternalUrl', () => {
  it('adds https:// when the scheme is missing', () => {
    expect(normalizeExternalUrl('shopee.vn/product/123')).toBe('https://shopee.vn/product/123');
  });

  it('keeps http and https links as they are', () => {
    expect(normalizeExternalUrl('http://a.com/x')).toBe('http://a.com/x');
    expect(normalizeExternalUrl('https://a.com/x?id=1&b=2')).toBe('https://a.com/x?id=1&b=2');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeExternalUrl('  https://a.com/x  ')).toBe('https://a.com/x');
  });

  it('rejects non-http(s) schemes', () => {
    expect(normalizeExternalUrl('javascript:alert(1)')).toBeUndefined();
    expect(normalizeExternalUrl('data:text/html,<script>alert(1)</script>')).toBeUndefined();
    expect(normalizeExternalUrl('ftp://a.com/file')).toBeUndefined();
    expect(normalizeExternalUrl('file:///etc/passwd')).toBeUndefined();
  });

  it('rejects empty input and things that are not real links', () => {
    expect(normalizeExternalUrl('')).toBeUndefined();
    expect(normalizeExternalUrl('   ')).toBeUndefined();
    expect(normalizeExternalUrl(undefined)).toBeUndefined();
    expect(normalizeExternalUrl('abc')).toBeUndefined();
  });
});
