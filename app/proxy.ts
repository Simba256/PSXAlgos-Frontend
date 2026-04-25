import { auth } from "@/auth"

export default auth((req) => {
  if (req.auth) return

  const url = new URL("/", req.nextUrl.origin)
  url.searchParams.set("auth", "required")
  url.searchParams.set("from", req.nextUrl.pathname)
  return Response.redirect(url)
})

export const config = {
  matcher: [
    "/signals/:path*",
    "/strategies/:path*",
    "/backtest/:path*",
    "/bots/:path*",
    "/portfolio/:path*",
  ],
}
