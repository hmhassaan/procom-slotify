import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  "projectId": "studio-9576419778-be5d0",
  "appId": "1:471147543731:web:78a6f6cf8b1045a206c4c6",
  "storageBucket": "studio-9576419778-be5d0.firebasestorage.app",
  "apiKey": "AIzaSyDc3XNV2_TkarvDSJA-a8S6McqlDU8FZbQ",
  "authDomain": "studio-9576419778-be5d0.firebaseapp.com",
  "messagingSenderId": "471147543731"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);

// Enable persistence
enableIndexedDbPersistence(db)
  .catch((err) => {
    if (err.code == 'failed-precondition') {
      // Multiple tabs open, persistence can only be enabled in one.
      // Silently fail.
    } else if (err.code == 'unimplemented') {
      // The current browser does not support all of the
      // features required to enable persistence
      console.log("Firebase persistence not available in this browser.");
    }
  });


// Initialize Analytics and export it for use in other parts of the app
isSupported().then(supported => {
  if (supported) {
    getAnalytics(app);
    console.log("Firebase Analytics initialized successfully.");
  } else {
    console.log("Firebase Analytics is not supported in this environment.");
  }
});
