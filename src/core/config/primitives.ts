export function requiredBoolean(field: string, value: unknown): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`[Corelens] ${field} is required and must be a boolean`);
  }
  return value;
}

export function intInRange(
  field: string,
  value: unknown,
  min: number,
  max: number,
): number {
  if (!Number.isInteger(value)) {
    throw new Error(`[Corelens] ${field} must be an integer`);
  }

  const numberValue = Number(value);
  if (numberValue < min || numberValue > max) {
    throw new Error(`[Corelens] ${field} must be between ${min} and ${max}`);
  }

  return numberValue;
}

export function numberInRange(
  field: string,
  value: unknown,
  min: number,
  max: number,
): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`[Corelens] ${field} must be a number`);
  }

  if (value < min || value > max) {
    throw new Error(`[Corelens] ${field} must be between ${min} and ${max}`);
  }

  return value;
}

export function nonEmptyString(field: string, value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`[Corelens] ${field} must be a non-empty string`);
  }
  return value;
}

export function oneOf<T extends string>(
  field: string,
  value: unknown,
  allowed: readonly T[],
): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new Error(
      `[Corelens] ${field} must be one of: ${allowed.join(', ')}`,
    );
  }
  return value as T;
}

export function url(field: string, value: unknown): string {
  const endpoint = nonEmptyString(field, value);
  try {
    new URL(endpoint);
  } catch {
    throw new Error(`[Corelens] ${field} must be a valid URL`);
  }
  return endpoint;
}

export function optionalRecordOfStrings(
  field: string,
  value: unknown,
): Record<string, string> {
  if (value === undefined) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`[Corelens] ${field} must be an object of string values`);
  }

  const result: Record<string, string> = {};
  for (const [key, headerValue] of Object.entries(value)) {
    if (typeof headerValue !== 'string') {
      throw new Error(`[Corelens] ${field}.${key} must be a string`);
    }
    result[key] = headerValue;
  }
  return result;
}
