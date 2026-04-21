import { getTargetContinents } from './direction-map';

describe('getTargetContinents', () => {
  it('returns correct targets for a known continent+direction', () => {
    expect(getTargetContinents('na', 60)).toEqual(['eu']);
  });

  it('returns multiple targets when the direction fans out', () => {
    expect(getTargetContinents('sa', 30)).toEqual(['na', 'eu']);
  });

  it('returns empty array for a direction with no targets', () => {
    expect(getTargetContinents('na', 0)).toEqual([]);
  });

  it('returns empty array for an unknown continent', () => {
    expect(getTargetContinents('xx', 90)).toEqual([]);
  });

  it('returns empty array for an unknown direction on a known continent', () => {
    expect(getTargetContinents('na', 999)).toEqual([]);
  });

  it('covers all six continents without throwing', () => {
    const continents = ['na', 'sa', 'eu', 'af', 'as', 'oc'];
    const directions = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
    for (const c of continents) {
      for (const d of directions) {
        expect(() => getTargetContinents(c, d)).not.toThrow();
      }
    }
  });
});
