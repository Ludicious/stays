import { NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'crypto';
import { createSessionToken, COOKIE_NAME, SESSION_MAX_AGE } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body     = await request.json() as { password?: string };
    const submitted = body.password ?? '';
    const expected  = process.env.APP_PASSWORD ?? '';

    // Hash both sides before comparing — timingSafeEqual requires equal-length buffers
    const a = createHash('sha256').update(submitted).digest();
    const b = createHash('sha256').update(expected).digest();

    if (!timingSafeEqual(a, b)) {
      return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 });
    }

    const token = await createSessionToken();
    const res   = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure:   true,
      sameSite: 'lax',
      maxAge:   SESSION_MAX_AGE,
      path:     '/',
    });
    return res;
  } catch {
    return NextResponse.json({ error: 'Login failed.' }, { status: 500 });
  }
}
