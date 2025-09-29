
import { getGoogleAuthUrlFlow } from '@/ai/flows/google-auth-flow';
import { appRoute } from '@genkit-ai/next';

export const runtime = 'nodejs';

// This creates the POST handler for starting the Google Auth flow
export const POST = appRoute(getGoogleAuthUrlFlow);
