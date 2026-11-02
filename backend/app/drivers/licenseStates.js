// Fixed USPS state and DC list for driver licenseState (Feature 5).
export const LICENSE_STATES = Object.freeze([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL",
  "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME",
  "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH",
  "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI",
  "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
]);

const LICENSE_STATE_SET = new Set(LICENSE_STATES);

export const isLicenseState = (value) => LICENSE_STATE_SET.has(value);

export const optionsPayload = () => ({ licenseStates: [...LICENSE_STATES] });
