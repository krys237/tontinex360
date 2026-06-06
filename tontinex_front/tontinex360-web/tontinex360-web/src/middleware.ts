import { NextRequest, NextResponse } from 'next/server';

const PUBLIC = ['/login', '/register', '/forgot-password', '/invite', '/_next', '/favicon'];

/**
 * Middleware Next.js minimal :
 * - Laisse passer les routes publiques
 * - Pour les autres, le DashboardLayout côté client vérifie le token en localStorage
 *   (les tokens JWT sont stockés client-side, donc impossible de valider en SSR sans cookies)
 *
 * NB : pour migrer vers une protection serveur, il faudra écrire les tokens
 * dans des cookies HttpOnly côté backend Django (Set-Cookie) et lire ici
 * `req.cookies.get('access_token')`.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
