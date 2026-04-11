export const DIRECTION_TO_CONTINENTS: Record<string, Record<number, string[]>> = {
  na: {
    0: [], 30: [], 60: ['eu'], 90: ['eu'], 120: ['sa', 'af'], 150: ['sa'],
    180: ['sa'], 210: [], 240: [], 270: [], 300: ['as'], 330: [],
  },
  sa: {
    0: ['na'], 30: ['na', 'eu'], 60: ['eu', 'af'], 90: ['af'], 120: ['af'],
    150: [], 180: [], 210: [], 240: [], 270: ['oc'], 300: [], 330: ['na'],
  },
  eu: {
    0: [], 30: ['as'], 60: ['as'], 90: ['as'], 120: ['as', 'af'], 150: ['af'],
    180: ['af'], 210: ['sa'], 240: ['sa', 'na'], 270: ['na'], 300: ['na'], 330: [],
  },
  af: {
    0: ['eu'], 30: ['eu', 'as'], 60: ['as'], 90: ['as', 'oc'], 120: ['oc'],
    150: ['oc'], 180: [], 210: ['sa'], 240: ['sa'], 270: ['na'], 300: ['eu', 'na'], 330: ['eu'],
  },
  as: {
    0: [], 30: [], 60: ['na'], 90: ['oc'], 120: ['oc'], 150: ['af', 'oc'],
    180: ['af'], 210: ['af'], 240: ['eu', 'af'], 270: ['eu'], 300: ['eu'], 330: [],
  },
  oc: {
    0: ['as'], 30: ['as'], 60: ['as'], 90: [], 120: [], 150: [],
    180: [], 210: ['sa'], 240: ['sa'], 270: ['na'], 300: ['na', 'as'], 330: ['as'],
  },
};

export function getTargetContinents(continentId: string, direction: number): string[] {
  return DIRECTION_TO_CONTINENTS[continentId]?.[direction] ?? [];
}
