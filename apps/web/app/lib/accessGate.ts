const encoder = new TextEncoder();

export const ACCESS_COOKIE = "health_access";

export async function accessCookieValue(password: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(`health-web:${password}`));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function safeNextPath(value: FormDataEntryValue | string | string[] | null | undefined): string {
  const next = Array.isArray(value) ? value[0] : typeof value === "string" ? value : "/";
  if (!next.startsWith("/") || next.startsWith("//")) return "/";
  if (next.startsWith("/unlock")) return "/";
  return next;
}
