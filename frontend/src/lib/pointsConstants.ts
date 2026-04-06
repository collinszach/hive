/** Points-per-cent valuations — mirrors CLAUDE.md / backend tracker.py exactly */
export const POINT_VALUES_CPP: Record<string, number> = {
  "Amex MR":           2.0,
  "Chase UR":          2.05,
  "SW RR":             1.4,
  "Bilt Points":       2.1,
  "WF Rewards":        1.0,
  "Capital One Miles": 1.85,
};

/** Redemption nudge thresholds — mirrors CLAUDE.md exactly */
export const REDEMPTION_THRESHOLDS: Record<string, number> = {
  "Chase UR":           60_000,
  "Amex MR":            75_000,
  "SW RR":              50_000,
  "Bilt Points":        50_000,
  "Capital One Miles":  75_000,
  "WF Rewards":         25_000,
};
