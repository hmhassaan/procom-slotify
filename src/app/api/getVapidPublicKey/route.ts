// app/api/vapid/route.ts
import { appRoute } from '@genkit-ai/next';
import { getVapidPublicKey } from '@/ai/flows/notify-flow';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Optional: add HTTP caching (public, 1 day)
const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
};

export const POST = async (req: Request) => {
  try {
    // appRoute returns a handler; call it to run the flow
    const handler = appRoute(getVapidPublicKey);
    const res = await handler(req as any);

    // ensure caching headers even on success
    const data = await res.json();
    return NextResponse.json(data, { status: 200, headers: CACHE_HEADERS });
  } catch (err: any) {
    // Don’t expose stack traces
    const message =
      process.env.VAPID_PUBLIC_KEY ? 'Failed to fetch VAPID key.' : 'VAPID key not configured.';
    const status = process.env.VAPID_PUBLIC_KEY ? 500 : 503;

    // Log full error server-side
    console.error('getVapidPublicKey error:', err);

    return NextResponse.json({ error: message }, { status });
  }
};
