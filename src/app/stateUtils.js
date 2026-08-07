export function normalizeSavedState(saved, defaultValue) {
  if (saved === undefined || saved === null) return defaultValue;
  if (!defaultValue || typeof defaultValue !== "object" || Array.isArray(defaultValue)) return saved;
  const base = { ...defaultValue, ...saved };
  if (defaultValue.vals || saved.vals) {
    base.vals = { ...(defaultValue.vals || {}), ...((saved && saved.vals) || {}) };
  }
  return base;
}

export function createSavedFilterReader(savedFilters) {
  return (key, defaultValue) => normalizeSavedState(savedFilters?.[key], defaultValue);
}
