// Matches ASCII control characters, space and backslash — characters the WHATWG URL
// parser strips or reinterprets, which could otherwise smuggle a foreign host into
// a value that looks like a same-site relative path.
const UNSAFE_CHARS = /[\x00-\x20\x7F\\]/;

export function safeCallbackPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  if (UNSAFE_CHARS.test(value)) return fallback;
  return value;
}
