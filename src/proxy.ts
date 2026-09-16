import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PATHS = ["/home", "/onboarding"];

// Server Components can't write cookies, so the sliding session refresh happens here.
export async function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    if (PROTECTED_PATHS.includes(request.nextUrl.pathname)) {
      return NextResponse.redirect(new URL("/sign-in", request.url));
    }
    return NextResponse.next();
  }

  try {
    // Imported lazily so requests without a session never pull in the auth/database modules.
    const { auth } = await import("@/lib/auth");
    const sessionResponse = await auth.api.getSession({ headers: request.headers, asResponse: true });
    const response = NextResponse.next();
    for (const cookie of sessionResponse.headers.getSetCookie()) {
      response.headers.append("set-cookie", cookie);
    }
    return response;
  } catch (error) {
    console.error("Session refresh failed", error);
    return NextResponse.next();
  }
}

export const config = {
  matcher: ["/", "/home", "/onboarding", "/invite/:path*", "/plans/:path*"],
};
