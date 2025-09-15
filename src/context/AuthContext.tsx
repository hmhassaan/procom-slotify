
"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut, User as FirebaseUser } from "firebase/auth";
import { auth } from '@/lib/firebase';

type CustomUser = {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  // Add other properties as needed to mimic FirebaseUser
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

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ hd: "nu.edu.pk", prompt: "select_account" });
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
      // also clear admin bypass
      setIsAdminBypass(false);
      setCurrentUser(null);
    } catch (error) {
      console.error("Error during sign-out:", error);
    }
  };

  const adminLogin = (password: string) => {
    if (password === 'ViratKohli18') {
      const adminUser: CustomUser = {
        uid: 'admin-bypass-user',
        displayName: 'Admin',
        email: 'admin@example.com',
        photoURL: null,
      };
      setCurrentUser(adminUser);
      setIsAdminBypass(true);
      setLoading(false);
    } else {
      throw new Error('Incorrect password');
    }
  };

  useEffect(() => {
    const adminBypassState = sessionStorage.getItem('isAdminBypass') === 'true';
    if(adminBypassState) {
        const adminUser: CustomUser = {
            uid: 'admin-bypass-user',
            displayName: 'Admin',
            email: 'admin@example.com',
            photoURL: null,
          };
        setCurrentUser(adminUser);
        setIsAdminBypass(true);
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!sessionStorage.getItem('isAdminBypass')) {
        setCurrentUser(user);
      }
      setLoading(false);
    });
    
    return unsubscribe;
  }, []);


  useEffect(() => {
    if (isAdminBypass) {
        sessionStorage.setItem('isAdminBypass', 'true');
    } else {
        sessionStorage.removeItem('isAdminBypass');
    }
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
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
