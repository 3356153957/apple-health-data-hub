import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { ACCESS_COOKIE, accessCookieValue } from "./app/lib/accessGate";

const PUBLIC_FILE = /\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|txt|xml|json|map)$/i;

function isPublicPath(pathname: string): boolean {
  return (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/unlock") ||
    pathname === "/icon.svg" ||
    PUBLIC_FILE.test(pathname)
  );
}

function nextWithPath(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-health-pathname", request.nextUrl.pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

function redirectToUnlock(request: NextRequest) {
  const unlockUrl = request.nextUrl.clone();
  unlockUrl.pathname = "/unlock";
  unlockUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(unlockUrl);
}

export async function middleware(request: NextRequest) {
  const password = process.env.HEALTH_WEB_PASSWORD;
  if (isPublicPath(request.nextUrl.pathname)) {
    return nextWithPath(request);
  }

  if (!password) {
    return redirectToUnlock(request);
  }

  if (request.cookies.get(ACCESS_COOKIE)?.value === await accessCookieValue(password)) {
    return nextWithPath(request);
  }

  return redirectToUnlock(request);
}

export const config = {
  matcher: ["/((?!api).*)"],
};
