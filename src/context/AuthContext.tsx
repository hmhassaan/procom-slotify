"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut, User as FirebaseUser } from "firebase/auth";
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      'hd': 'nu.edu.pk'
    });
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Error during sign-in:", error);
      throw error;
    }
  };

  const firebaseSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error during sign-out:", error);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    loading,
    signIn,
    signOut: firebaseSignOut,
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
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
