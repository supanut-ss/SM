import { NextResponse, type NextRequest } from "next/server";

const ACCESS_TOKEN_COOKIE = "access_token";
// /403 ต้องเข้าได้เสมอแม้ไม่มี cookie เลย — เป็นหน้าอธิบายเหตุผล ไม่ใช่หน้าที่ต้อง login ก่อนถึงจะเห็น
const PUBLIC_PATHS = ["/login", "/403"];

/**
 * เช็คแค่ "มี cookie access_token ไหม" (เร็ว รันบน edge ได้) เพื่อกันหน้าตาเปล่า ๆ ก่อน redirect
 * ไปหน้า login เท่านั้น — ไม่ใช่ตัวบังคับสิทธิ์จริง สิทธิ์จริงเช็คที่ apps/api ทุกครั้ง
 * (JwtAuthGuard ยืนยันลายเซ็น + PermissionGuard เช็คสิทธิ์ต่อสาขา) เพราะ middleware ฝั่ง client
 * ปลอมได้ (แก้ cookie เองได้) ห้ามใช้เป็นด่านความปลอดภัยเดียว — ดู CLAUDE.md
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.has(ACCESS_TOKEN_COOKIE);
  if (!hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // ทุก path ยกเว้น: API route, static asset ของ Next, ไฟล์ favicon, และหน้า dev styleguide
    "/((?!api|_next/static|_next/image|favicon.ico|dev).*)",
  ],
};
