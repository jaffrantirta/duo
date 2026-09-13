import "server-only";
import { cookies } from "next/headers";

export const TZ_COOKIE = "tz";

export async function getViewerTimeZone(): Promise<string> {
  return (await cookies()).get(TZ_COOKIE)?.value ?? "UTC";
}
