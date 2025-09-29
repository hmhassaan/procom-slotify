
'use server';
/**
 * @fileOverview Flows for handling Google OAuth 2.0 for Calendar API access.
 *
 * - getGoogleAuthUrlFlow - Generates the URL for the Google consent screen.
 * - handleGoogleAuthCallbackFlow - Handles the callback from Google after user consent.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { google } from 'googleapis';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const GAuthUrlInputSchema = z.object({
  userId: z.string(),
});
const GAuthUrlOutputSchema = z.object({
  authUrl: z.string(),
});

const GAuthCallbackInputSchema = z.object({
  code: z.string(),
  state: z.string(), // Contains the userId
});

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

export const getGoogleAuthUrlFlow = ai.defineFlow(
  {
    name: 'getGoogleAuthUrlFlow',
    inputSchema: GAuthUrlInputSchema,
    outputSchema: GAuthUrlOutputSchema,
  },
  async ({ userId }) => {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      throw new Error('Google OAuth client ID or secret is not configured.');
    }
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline', // Important to get a refresh token
      scope: ['https://www.googleapis.com/auth/calendar.events'],
      prompt: 'consent', // Force consent screen to get refresh token every time
      state: userId, // Pass userId to identify the user in the callback
    });
    return { authUrl };
  }
);


export const handleGoogleAuthCallbackFlow = ai.defineFlow(
  {
    name: 'handleGoogleAuthCallbackFlow',
    inputSchema: GAuthCallbackInputSchema,
    outputSchema: z.void(),
  },
  async ({ code, state: userId }) => {
    if (!userId) {
      throw new Error('User ID (state) is missing from the OAuth callback.');
    }
    try {
      const { tokens } = await oauth2Client.getToken(code);
      const { refresh_token } = tokens;

      if (!refresh_token) {
        // This can happen if the user has already granted consent and is not re-prompted.
        // The `prompt: 'consent'` option in generateAuthUrl helps mitigate this.
        console.warn(`No refresh token received for user ${userId}. They may have already authorized the app.`);
        // Even if we don't get a new refresh token, the auth was successful.
        // We might already have one stored.
        return;
      }

      // Securely store the refresh token in Firestore
      const userDocRef = doc(db, 'users', userId);
      await updateDoc(userDocRef, {
        googleRefreshToken: refresh_token,
      });

      console.log(`Successfully stored Google Calendar refresh token for user ${userId}.`);
    } catch (error: any) {
      console.error('Error exchanging auth code for tokens:', error.message);
      throw new Error('Failed to get authorization tokens from Google.');
    }
  }
);
