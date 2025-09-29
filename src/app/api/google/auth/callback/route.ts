
import { handleGoogleAuthCallbackFlow } from '@/ai/flows/google-auth-flow';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

// This is the redirect URI for Google OAuth
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code || !state) {
    return new Response('Missing code or state query parameter', { status: 400 });
  }

  try {
    // Run the Genkit flow to handle token exchange and storage
    await handleGoogleAuthCallbackFlow.run({ code, state });

    // Redirect the user back to the profile page upon success
    return new Response(null, {
      status: 302,
      headers: {
        Location: '/add-schedule',
      },
    });
  } catch (error: any) {
    console.error('Google Auth Callback Error:', error);
    // You could redirect to an error page
    return new Response(error.message, { status: 500 });
  }
}
