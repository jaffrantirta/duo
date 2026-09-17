import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PATHS = ["/home", "/onboarding"];
const REFRESH_COOKIE = "session-refresh";
const REFRESH_INTERVAL_MS = 60 * 60 * 1000;

// Server Components can't write cookies, so the sliding session refresh happens here.
// The refresh is a DB round trip and only extends a cookie that's already good for days,
// so it's throttled by a timestamp-only marker cookie rather than run on every navigation.
export async function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    if (PROTECTED_PATHS.includes(request.nextUrl.pathname)) {
      return NextResponse.redirect(new URL("/sign-in", request.url));
    }
    return NextResponse.next();
  }

  const lastRefreshed = Number(request.cookies.get(REFRESH_COOKIE)?.value ?? 0);
  if (Date.now() - lastRefreshed < REFRESH_INTERVAL_MS) {
    return NextResponse.next();
  }

  try {
    // Imported lazily so a throttled request never pulls in the auth/database modules.
    const { auth } = await import("@/lib/auth");
    const sessionResponse = await auth.api.getSession({ headers: request.headers, asResponse: true });
    const response = NextResponse.next();
    for (const cookie of sessionResponse.headers.getSetCookie()) {
      response.headers.append("set-cookie", cookie);
    }
    response.cookies.set(REFRESH_COOKIE, String(Date.now()), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: REFRESH_INTERVAL_MS / 1000,
    });
    return response;
  } catch (error) {
    console.error("Session refresh failed", error);
    return NextResponse.next();
  }
}

export const config = {
  matcher: ["/", "/home", "/onboarding", "/invite/:path*", "/plans/:path*"],
};
