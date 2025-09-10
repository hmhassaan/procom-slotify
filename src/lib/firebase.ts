import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  "projectId": "studio-9576419778-be5d0",
  "appId": "1:471147543731:web:78a6f6cf8b1045a206c4c6",
  "storageBucket": "studio-9576419778-be5d0.firebasestorage.app",
  "apiKey": "AIzaSyDc3XNV2_TkarvDSJA-a8S6McqlDU8FZbQ",
  "authDomain": "studio-9576419778-be5d0.firebaseapp.com",
  "messagingSenderId": "471147543731"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
