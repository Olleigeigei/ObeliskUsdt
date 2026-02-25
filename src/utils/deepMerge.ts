/**
 * 深度合并工具
 *
 * @author Telegram @Mhuai8
 */

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === '[object Object]';
}

export function deepMerge<T>(base: T, override?: Partial<T>): T {
  if (!override) {
    return JSON.parse(JSON.stringify(base)) as T;
  }
  const output = Array.isArray(base)
    ? ([...base] as unknown as Record<string, unknown>)
    : ({ ...(base as Record<string, unknown>) } as Record<string, unknown>);

  for (const [key, value] of Object.entries(override as Record<string, unknown>)) {
    if (value === undefined) {
      continue;
    }
    const currentValue = output[key];
    if (isPlainObject(currentValue) && isPlainObject(value)) {
      output[key] = deepMerge(currentValue, value);
    } else if (Array.isArray(value)) {
      output[key] = [...value];
    } else {
      output[key] = value;
    }
  }

  return output as T;
}
