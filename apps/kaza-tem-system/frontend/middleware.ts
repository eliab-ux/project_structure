import { NextRequest, NextResponse } from 'next/server';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api').replace(
  /\/$/,
  '',
);
const TRACKING_ENDPOINT = `${API_BASE}/tracking/visit`;

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const match = request.nextUrl.pathname.match(/^\/r\/([^/]+)\/?$/);
  if (!match) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  try {
    const payload = {
      link: match[1],
      visitorId: request.cookies.get('kazaTemVisitorId')?.value,
      pageUrl: request.nextUrl.toString(),
    };

    const apiResponse = await fetch(TRACKING_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!apiResponse.ok) {
      return response;
    }

    const data = await apiResponse.json().catch(() => null);
    const visitorId = data?.visitorId ?? payload.visitorId;
    const resellerId = data?.resellerId;

    if (visitorId) {
      response.cookies.set('kazaTemVisitorId', visitorId, {
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    if (resellerId) {
      response.cookies.set('kazaTemResellerId', resellerId, {
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    response.cookies.set('kazaTemVisitRecorded', '1', {
      path: '/',
      maxAge: 60,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[middleware] Não foi possível registrar a visita', error);
  }

  return response;
}

export const config = {
  matcher: ['/r/:link*'],
};
