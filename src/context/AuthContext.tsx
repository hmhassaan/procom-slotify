"use client";

import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useRef,
  useMemo,
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
import type { User } from "@/app/types";
import { useAppContext } from "./AppContext";


interface AuthContextType {
  currentUser: FirebaseUser | null;
  currentUserProfile: User | null;
  loading: boolean;
  isAdmin: boolean;
  isTeamAdmin: boolean;
  isSubTeamAdmin: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  adminLogin: (password: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const { users, loading: appLoading } = useAppContext();
  const signingRef = useRef(false);

  // After successful auth (popup or redirect), go home
  const handleRedirectResult = async () => {
    try {
      await getRedirectResult(auth);
    } catch (error) {
       // Ignore benign cases like "no redirect"
    }
  };
  handleRedirectResult();

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
        await signInWithRedirect(auth, provider);
        return; 
      }
      console.error("Sign in failed", error);
    } finally {
      signingRef.current = false;
    }
  };
  
  const [isAdminBypass, setIsAdminBypass] = useState(false);
  
  const adminLogin = (password: string) => {
    if (password === "ViratKohli18") {
      const adminUser: User = {
        id: "admin-bypass-user",
        name: "Admin",
        nuId: "N/A",
        email: "admin@example.com",
        courses: [],
        team: "N/A",
        position: "N/A",
        offDays: [],
        role: 'universal',
      };
      // This is a bit of a hack to work with the existing structure.
      // In a real scenario, you wouldn't mix FirebaseUser and a custom object.
      setCurrentUser({
        uid: adminUser.id,
        displayName: adminUser.name,
        email: adminUser.email,
      } as FirebaseUser);
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
      setCurrentUser(user);
      setLoading(false);
      // Admin bypass is session-only, so it's not persisted here.
    });

    return unsubscribe;
  }, []);
  
  const currentUserProfile = useMemo(() => {
    if (isAdminBypass) {
        return {
             id: "admin-bypass-user",
             name: "Admin",
             nuId: "N/A",
             email: "admin@example.com",
             courses: [],
             team: "N/A",
             position: "N/A",
             offDays: [],
             role: 'universal',
        } as User;
    }
    return users.find(u => u.id === currentUser?.uid) ?? null;
  }, [currentUser, users, isAdminBypass]);

  const isAdmin = currentUserProfile?.role === 'universal';
  const isTeamAdmin = currentUserProfile?.role === 'team';
  const isSubTeamAdmin = currentUserProfile?.role === 'subTeam';

  const authLoading = loading || appLoading;

  const value = {
    currentUser,
    currentUserProfile,
    loading: authLoading,
    isAdmin,
    isTeamAdmin,
    isSubTeamAdmin,
    signIn,
    signOut: firebaseSignOut,
    adminLogin,
  };

  return (
    <AuthContext.Provider value={value}>
      {!authLoading && children}
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
