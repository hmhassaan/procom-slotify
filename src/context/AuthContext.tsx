
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
import { toast } from "@/hooks/use-toast";


interface AuthContextType {
  currentUser: FirebaseUser | null;
  loading: boolean;
  isAdminBypass: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  adminLogin: (password: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const signingRef = useRef(false);
  const [isAdminBypass, setIsAdminBypass] = useState(false);

  useEffect(() => {
    const handleRedirectResult = async () => {
      try {
        // This is to handle the redirect result after a user signs in.
        // It's safe to call on every page load.
        await getRedirectResult(auth);
      } catch (error) {
         // This can happen if there is no redirect result to process.
         // We can safely ignore it.
      }
    };
    handleRedirectResult();
  }, []);

  const signIn = async () => {
    if (signingRef.current) return;
    signingRef.current = true;

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ hd: "nu.edu.pk", prompt: "select_account" });

    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      if (
        error?.code === "auth/popup-blocked" ||
        error?.code === "auth/popup-closed-by-user" ||
        error?.code === "auth/cancelled-popup-request"
      ) {
        // Fallback to redirect if popups are blocked/closed.
        await signInWithRedirect(auth, provider);
        return; 
      }
      console.error("Sign in failed", error);
    } finally {
      signingRef.current = false;
    }
  };
  
  const adminLogin = (password: string) => {
    if (password === "ViratKohli18") {
      const adminUser: Partial<FirebaseUser> = {
        uid: "admin-bypass-user",
        displayName: "Admin",
        email: "admin@example.com",
      };
      setCurrentUser(adminUser as FirebaseUser);
      setIsAdminBypass(true);
    } else {
      throw new Error("Incorrect password");
    }
  };


  const firebaseSignOut = async () => {
    try {
      await signOut(auth);
      setCurrentUser(null);
      setIsAdminBypass(false);
    } catch (error) {
      console.error("Error during sign-out:", error);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && user.email && !user.email.endsWith('@nu.edu.pk')) {
        firebaseSignOut();
        toast({
          variant: "destructive",
          title: "Sign-in Failed",
          description: "Please sign in with your NU Account (e.g., k224404@nu.edu.pk).",
        });
        setLoading(false);
        return;
      }

      if (!isAdminBypass) {
        setCurrentUser(user);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, [isAdminBypass]);
  

  const value = {
    currentUser,
    loading,
    isAdminBypass,
    signIn,
    signOut: firebaseSignOut,
    adminLogin,
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
