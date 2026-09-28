/** JSON replacer that stringifies bigints (Express `json replacer` setting + manual stringify). */
export function jsonReplacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}

export function stringifySafe(v: unknown, space?: number): string {
  return JSON.stringify(v, jsonReplacer, space);
}

/** Deep-converts bigints to strings so the value can be stored in Mongo or logged. */
export function toPlain<T>(v: T): T {
  return JSON.parse(stringifySafe(v)) as T;
}
