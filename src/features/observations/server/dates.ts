const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeDateOnly(
  value: unknown,
  field: string,
  options: { required?: boolean } = {},
): string | null {
  if (typeof value !== "string" || !value.trim()) {
    if (options.required) throw new Error(`${field} is required.`);
    return null;
  }

  const input = value.trim();
  const parsed = new Date(
    DATE_ONLY_PATTERN.test(input) ? `${input}T00:00:00.000Z` : input,
  );
  if (Number.isNaN(parsed.getTime())) throw new Error(`${field} is invalid.`);

  const dateOnly = parsed.toISOString().slice(0, 10);
  if (DATE_ONLY_PATTERN.test(input) && dateOnly !== input) {
    throw new Error(`${field} is invalid.`);
  }
  return dateOnly;
}

export function dateOnlyToIso(value: string | null): string | null {
  return value ? `${value}T00:00:00.000Z` : null;
}
