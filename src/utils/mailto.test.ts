import { describe, it, expect } from 'vitest';
import { buildMailtoUrl } from './mailto';

describe('buildMailtoUrl', () => {
  it('percent-encodes spaces as %20, never as +', () => {
    const url = buildMailtoUrl({ to: 'a@b.com', subject: 'Happy Birthday to Ms. A' });
    expect(url).not.toContain('+');
    expect(url).toContain('Happy%20Birthday%20to%20Ms.%20A');
  });

  it('joins multiple CC addresses with a comma', () => {
    const url = buildMailtoUrl({ to: 'a@b.com', cc: ['x@y.com', 'z@y.com'], subject: 'Hi' });
    expect(url).toContain('cc=' + encodeURIComponent('x@y.com,z@y.com'));
  });

  it('omits the cc param entirely when no CC is given', () => {
    const url = buildMailtoUrl({ to: 'a@b.com', subject: 'Hi' });
    expect(url).not.toContain('cc=');
  });
});
