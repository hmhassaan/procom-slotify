// firebaseClient.ts
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import {
  getFirestore,
  enableIndexedDbPersistence,
  // enableMultiTabIndexedDbPersistence, // use this if you want multi-tab
  type Firestore,
} from "firebase/firestore";

const firebaseConfig = {
  projectId: "studio-9576419778-be5d0",
  appId: "1:471147543731:web:78a6f6cf8b1045a206c4c6",
  // ⚠️ For Storage SDK later, prefer the appspot.com bucket name shown in console:
  // storageBucket: "studio-9576419778-be5d0.appspot.com",
  storageBucket: "studio-9576419778-be5d0.firebasestorage.app",
  apiKey: "AIzaSyDc3XNV2_TkarvDSJA-a8S6McqlDU8FZbQ",
  authDomain: "studio-9576419778-be5d0.firebaseapp.com",
  messagingSenderId: "471147543731",
  // ✅ REQUIRED for Analytics:
  // measurementId: "G-XXXXXXXXXX",
};

const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth: Auth = getAuth(app);
const db: Firestore = getFirestore(app);

// Enable Firestore persistence only in the browser
if (typeof window !== "undefined") {
  enableIndexedDbPersistence(db).catch((err: any) => {
    if (err?.code === "failed-precondition") {
      // Multiple tabs open; persistence enabled in one tab only
    } else if (err?.code === "unimplemented") {
      // Browser doesn’t support IndexedDB (Safari/Private mode, some envs)
      console.log("Firestore persistence not available in this browser.");
    } else {
      console.log("Firestore persistence error:", err);
    }
  });

  // Lazy-load Analytics only in the browser and only if supported & configured
  (async () => {
    try {
      const { isSupported, getAnalytics } = await import("firebase/analytics");
      const supported = await isSupported();
      // Also require a measurementId in config
      if (supported && "measurementId" in firebaseConfig && firebaseConfig.measurementId) {
        getAnalytics(app);
        console.log("Firebase Analytics initialized successfully.");
      } else {
        console.log("Firebase Analytics not initialized (unsupported or missing measurementId).");
      }
    } catch (e) {
      // Swallow analytics errors quietly in SSR / unsupported envs
      console.log("Analytics init skipped:", e);
    }
  })();
}

export { app, auth, db };
