import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/cadastro",
  "/recuperar-senha",
  "/verificar",
  "/api/webhooks",
  "/api/health",
];

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const url = req.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => url.pathname.startsWith(p));

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(toSet) {
          toSet.forEach(({ name, value, options }: { name: string; value: string; options?: CookieOptions }) =>
            res.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect logged-in users away from /login or /cadastro
  if (user && (url.pathname === "/login" || url.pathname === "/cadastro")) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Allow visitors to view "/" (home) — gated content is server-side anyway
  if (!user && !isPublic && url.pathname.startsWith("/admin")) {
    return NextResponse.redirect(new URL("/login?next=" + url.pathname, req.url));
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons|manifest.webmanifest|sw.js).*)"],
};
