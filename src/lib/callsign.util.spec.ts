import { generateCallsign } from './callsign.util';

describe('generateCallsign', () => {
  it('matches OPERATOR-NNNN format', () => {
    expect(generateCallsign()).toMatch(/^OPERATOR-\d{4}$/);
  });

  it('digit suffix is between 1000 and 9999', () => {
    const n = parseInt(generateCallsign().split('-')[1], 10);
    expect(n).toBeGreaterThanOrEqual(1000);
    expect(n).toBeLessThanOrEqual(9999);
  });

  it('two successive calls are not always identical', () => {
    const results = new Set(
      Array.from({ length: 20 }, () => generateCallsign()),
    );
    expect(results.size).toBeGreaterThan(1);
  });
});
