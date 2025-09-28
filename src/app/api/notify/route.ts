
import { notifyUserFlow } from '@/ai/flows/notify-flow';

export const runtime = 'nodejs'; // web-push needs Node.js crypto

export async function POST(req: Request) {
  let input: unknown;

  try {
    input = await req.json(); // <-- read the raw JSON body
  } catch {
    console.error('[notify] No/invalid JSON body');
    return Response.json(
      { error: 'Body must be JSON' },
      { status: 400 }
    );
  }

  console.log('[notify] incoming body:', input);

  try {
    // Run the Genkit action explicitly
    const result = await notifyUserFlow.run(input as any);
    return Response.json({ result }); // result will be null/void
  } catch (err: any) {
    console.error('[notify] flow error:', err);
    return Response.json(
      { error: err?.message ?? 'Flow error' },
      { status: 500 }
    );
  }
}
