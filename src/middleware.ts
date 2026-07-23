import { withAuth } from "next-auth/middleware";

export default withAuth({ pages: { signIn: "/login" } });

export const config = {
  matcher: [
    "/((?!login|api/auth|api/health|api/jobs|_next/static|_next/image|photos|uploads|favicon.ico).*)",
  ],
};
