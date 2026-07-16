import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protege el panel admin: sin sesión -> redirige a login
  if (request.nextUrl.pathname.startsWith("/admin") && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Cuenta suspendida: bloquea el acceso a todo excepto la propia página de suspendido
  if (user && !request.nextUrl.pathname.startsWith("/suspended")) {
    const { data: profile } = await supabase.from("profiles").select("active").eq("id", user.id).maybeSingle();
    if (profile && profile.active === false) {
      return NextResponse.redirect(new URL("/suspended", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/order/:path*", "/pro/:path*", "/support/:path*"],
};
