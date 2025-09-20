
import { appRoute } from '@genkit-ai/next';
import { getVapidPublicKey } from '@/ai/flows/notify-flow';

export const POST = appRoute(getVapidPublicKey);
