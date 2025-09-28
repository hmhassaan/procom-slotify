
import { getApps, initializeApp, cert, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Ensure this file is only run on the server
if (typeof window !== 'undefined') {
  throw new Error('firebase-admin should not be initialized in the browser.');
}

let app: App;
if (!getApps().length) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  app = initializeApp(
    serviceAccount
      ? { credential: cert(JSON.parse(serviceAccount)) }
      : undefined // Let Firebase use application default credentials
  );
} else {
  app = getApps()[0];
}

const adminDb = getFirestore(app);

export { app as adminApp, adminDb };
