
import { getApps, initializeApp, cert, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Ensure this file is only run on the server
if (typeof window !== 'undefined') {
  throw new Error('firebase-admin should not be initialized in the browser.');
}

const projectId = 'studio-9576419778-be5d0';

let app: App | undefined;

// Only initialize if the service account is available.
// This prevents crashes in local development environments.
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;

if (getApps().length === 0 && serviceAccountJson) {
  try {
    const serviceAccount = JSON.parse(serviceAccountJson);
    app = initializeApp({
      credential: cert(serviceAccount),
      projectId,
    });
  } catch (e) {
    console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT or initialize app:', e);
  }
} else if (getApps().length > 0) {
  app = getApps()[0];
}

const adminDb = app ? getFirestore(app) : undefined;

if (!adminDb) {
  console.warn(
    'Firebase Admin DB not initialized. FIREBASE_SERVICE_ACCOUNT env var might be missing. Server-side Firestore operations will fail.'
  );
}


export { app as adminApp, adminDb };
