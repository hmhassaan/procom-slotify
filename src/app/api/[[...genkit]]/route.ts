
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import {firebase, firebaseAuth} from 'genkit/firebase';
import {defineFlow, startFlowsServer} from 'genkit/server';
import {z} from 'zod';
import {prod} from 'genkit/environments';

// This must be defined before the ai() call.
const firebaseConfig = {
  projectId: "studio-9576419778-be5d0",
  appId: "1:471147543731:web:78a6f6cf8b1045a206c4c6",
  storageBucket: "studio-9576419778-be5d0.firebasestorage.app",
  apiKey: "AIzaSyDc3XNV2_TkarvDSJA-a8S6McqlDU8FZbQ",
  authDomain: "studio-9576419778-be5d0.firebaseapp.com",
  messagingSenderId: "471147543731",
};

genkit({
  plugins: [
    googleAI(),
    firebase({
      firebaseConfig,
      // The service account is automatically detected in prod.
      serviceAccount: prod ? undefined : JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS!),
    }),
    firebaseAuth(),
  ],
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});

export const GET = startFlowsServer();
export const POST = startFlowsServer();
