
import { appRoute } from '@genkit-ai/next';
import { notifyUserFlow } from '@/ai/flows/notify-flow';

export const runtime = 'nodejs'; // web-push needs Node.js crypto
export const POST = appRoute({ flow: notifyUserFlow });
