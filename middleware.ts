import { clerkClient, clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isAdminRoute = createRouteMatcher(['/admin(.*)', '/api/clio/auth/start']);

function parseAllowlist(): string[] {
  return (process.env.ADMIN_ALLOWED_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export default clerkMiddleware(async (auth, req) => {
  if (!isAdminRoute(req)) return;

  const { userId, sessionClaims, redirectToSignIn } = await auth();

  if (!userId) {
    return redirectToSignIn({ returnBackUrl: req.url });
  }

  let email = (sessionClaims?.email as string | undefined)?.toLowerCase();
  if (!email) {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    email = user.primaryEmailAddress?.emailAddress?.toLowerCase();
  }

  const allowlist = parseAllowlist();
  if (!email || !allowlist.includes(email)) {
    return new NextResponse('Forbidden: email not on admin allowlist.', { status: 403 });
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always match api routes
    '/(api|trpc)(.*)',
  ],
};
