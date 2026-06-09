import { NextRequest, NextResponse } from "next/server";

import { ACCESS_COOKIE, accessCookieValue, safeNextPath } from "../../lib/accessGate";

function unlockUrl(request: NextRequest, next: string, error: "bad" | "missing") {
  const url = new URL("/unlock", request.url);
  url.searchParams.set("next", next);
  url.searchParams.set("error", error);
  return url;
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const expected = process.env.HEALTH_WEB_PASSWORD;
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(formData.get("next"));

  if (!expected) {
    return NextResponse.redirect(unlockUrl(request, next, "missing"), 303);
  }

  if (password !== expected) {
    return NextResponse.redirect(unlockUrl(request, next, "bad"), 303);
  }

  const response = NextResponse.redirect(new URL(next, request.url), 303);
  response.cookies.set(ACCESS_COOKIE, await accessCookieValue(expected), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
