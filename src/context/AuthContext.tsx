"use client";

import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useRef,
} from "react";
import {
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  User as FirebaseUser,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

type CustomUser = {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
};

interface AuthContextType {
  currentUser: FirebaseUser | CustomUser | null;
  loading: boolean;
  isAdminBypass: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  adminLogin: (password: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | CustomUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdminBypass, setIsAdminBypass] = useState(false);
  const signingRef = useRef(false); // prevent overlapping sign-in attempts

  const signIn = async () => {
    if (signingRef.current) return;
    signingRef.current = true;

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ hd: "nu.edu.pk", prompt: "select_account" });

    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Error during sign-in:", error);

      // If the popup can’t complete (most common on dev hosts), fall back to redirect.
      if (
        error?.code === "auth/popup-blocked" ||
        error?.code === "auth/popup-closed-by-user" ||
        error?.code === "auth/cancelled-popup-request"
      ) {
        await signInWithRedirect(auth, provider);
        return; // page will navigate; no need to unset signingRef here
      }

      // Surface other errors
      throw error;
    } finally {
      // If we didn’t redirect, clear the flag
      signingRef.current = false;
    }
  };

  const firebaseSignOut = async () => {
    try {
      await signOut(auth);
      setIsAdminBypass(false);
      setCurrentUser(null);
    } catch (error) {
      console.error("Error during sign-out:", error);
    }
  };

  const adminLogin = (password: string) => {
    if (password === "ViratKohli18") {
      const adminUser: CustomUser = {
        uid: "admin-bypass-user",
        displayName: "Admin",
        email: "admin@example.com",
        photoURL: null,
      };
      setCurrentUser(adminUser);
      setIsAdminBypass(true);
    } else {
      throw new Error("Incorrect password");
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      // Don't persist admin bypass across reloads. It's a security risk.
      if (!isAdminBypass) {
        setCurrentUser(user);
      }
      setLoading(false);
    });

    // Complete any pending redirect-based sign-in (no-op if none)
    getRedirectResult(auth).catch(() => {
      // Ignore "no redirect" or benign cases
    });

    return unsubscribe;
  }, [isAdminBypass]);

  const value = {
    currentUser,
    loading,
    signIn,
    signOut: firebaseSignOut,
    adminLogin,
    isAdminBypass,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
