export const EMOJI = {
  APPROVE: '🟩',
  DENY: '🟥',
  ABUSE: '🟧'
} as const;

Object.freeze(EMOJI);

export const COLORS = {
  APPROVED: 6931610,
  DENIED: 15953004,
  FLAGGED: 15309853
} as const;

Object.freeze(COLORS);
