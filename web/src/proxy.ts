import { NextResponse, type NextRequest } from "next/server";

/**
 * One canonical, lowercase address per page ("/SP/Santo-Andre" → "/sp/santo-andre").
 * Done here rather than in the pages: a redirect rendered by a page is stored in the route cache under the
 * same key as the lowercase page on case-insensitive filesystems, which then serves the redirect in a loop.
 */
export function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = url.pathname.toLowerCase();
  return NextResponse.redirect(url, 308);
}

// Only paths with an uppercase letter; static assets with uppercase names (geo/uf/SP.topo.json) are left alone.
export const config = {
  matcher: ["/((?!_next/|geo/|data/|dados/csv/)(?:.*[A-Z].*))"],
};
