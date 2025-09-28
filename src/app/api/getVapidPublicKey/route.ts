
import { appRoute } from '@genkit-ai/next';
import { getVapidPublicKey } from '@/ai/flows/notify-flow';

export const runtime = 'nodejs';

// The POST handler is now created by wrapping the Genkit flow with appRoute.
// This ensures proper integration with the Genkit runtime.
export const POST = appRoute({ flow: getVapidPublicKey });
