import { toHexSequence } from './hex.util';

describe('toHexSequence', () => {
  it('converts ascii to spaced hex pairs', () => {
    expect(toHexSequence('hi')).toBe('68 69');
  });

  it('returns empty string for empty input', () => {
    expect(toHexSequence('')).toBe('');
  });

  it('round-trips: decoding the hex output yields the original string', () => {
    const input = 'Hello, Mars!';
    const hex = toHexSequence(input);
    const decoded = Buffer.from(hex.replace(/ /g, ''), 'hex').toString('utf8');
    expect(decoded).toBe(input);
  });

  it('handles multi-byte UTF-8 characters', () => {
    const input = '★';
    const hex = toHexSequence(input);
    const decoded = Buffer.from(hex.replace(/ /g, ''), 'hex').toString('utf8');
    expect(decoded).toBe(input);
  });

  it('each pair in the output is exactly two hex digits', () => {
    const pairs = toHexSequence('abc').split(' ');
    pairs.forEach((p) => expect(p).toMatch(/^[0-9a-f]{2}$/));
  });
});
