
import { notifyUserFlow } from '@/ai/flows/notify-flow';

export const runtime = 'nodejs'; // web-push needs Node.js crypto

export async function POST(req: Request) {
  let body: any = null;
  try {
    body = await req.json();
  } catch {
    console.error('[notify] No/invalid JSON body');
    return Response.json({ error: 'Body must be JSON' }, { status: 400 });
  }

  // Accept both {userId,...} and {input:{userId,...}}
  const payload = body?.input && typeof body.input === 'object' ? body.input : body;
  console.log('[notify] normalized payload:', payload);

  try {
    const result = await notifyUserFlow.run(payload);
    return Response.json({ result }); // null (void)
  } catch (err: any) {
    console.error('[notify] flow error:', err);
    return Response.json({ error: err?.message ?? 'Flow error' }, { status: 500 });
  }
}
