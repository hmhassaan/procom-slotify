
import { appRouter } from '@genkit-ai/next';
import { getVapidPublicKey } from '@/ai/flows/notify-flow';

export const POST = appRouter({
  flows: [getVapidPublicKey],
});
