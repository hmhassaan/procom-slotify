
"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { collection, doc, onSnapshot, setDoc, deleteDoc, writeBatch, getDocs, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { User, CategoryData, UserRole } from '@/app/types';

export type { User, CategoryData, UserRole };
export type SlotCoursesIndex = Record<string, Record<string, string[]>>;
export type Schedule = { [day: string]: { [time: string]: string | undefined }; };

interface AppState extends CategoryData {
  users: User[];
  allCourses: string[];
  timeSlots: string[];
  slotCourses: SlotCoursesIndex;
  loading: boolean;
}

interface AppContextType extends AppState {
  addUser: (user: User) => Promise<void>;
  updateUser: (userId: string, data: Partial<User>) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  clearAllUsers: () => Promise<void>;
  setScheduleData: (data: { slotCourses: SlotCoursesIndex; allCourses: string[]; timeSlots: string[]; }) => Promise<void>;
  updateCategories: (categories: CategoryData) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AppState>({
    users: [],
    allCourses: [],
    timeSlots: [],
    slotCourses: {},
    teams: [],
    positions: [],
    subTeams: {},
    loading: true,
  });

  const setScheduleData = useCallback(async (data: { slotCourses: SlotCoursesIndex; allCourses: string[]; timeSlots: string[]; }) => {
    const { slotCourses, allCourses, timeSlots } = data;
    const scheduleDoc = doc(db, 'schedule', 'main');
    await setDoc(scheduleDoc, { slotCourses, allCourses, timeSlots }, { merge: true });

    const usersCollection = collection(db, 'users');
    const usersSnapshot = await getDocs(usersCollection);
    const batch = writeBatch(db);
    usersSnapshot.forEach(userDoc => {
        const user = userDoc.data() as User;
        const updatedCourses = user.courses.filter(course => allCourses.includes(course));
        if (updatedCourses.length !== user.courses.length) {
            const userRef = doc(db, 'users', user.id);
            batch.update(userRef, { courses: updatedCourses });
        }
    });
    await batch.commit();
  }, []);

  const updateCategories = useCallback(async (categories: CategoryData) => {
    const categoryDoc = doc(db, 'schedule', 'categories');
    await setDoc(categoryDoc, categories);
  }, []);

  const updateUser = useCallback(async (userId: string, data: Partial<User>) => {
    const userDoc = doc(db, 'users', userId);
    // Firestore does not accept undefined, so we need to clean the object
    const cleanedData = Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined)
    );
    await updateDoc(userDoc, cleanedData);
  }, []);


  useEffect(() => {
    setState(prevState => ({ ...prevState, loading: true }));
    
    const usersUnsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
        const usersData = snapshot.docs.map(doc => doc.data() as User);
        setState(prevState => ({ ...prevState, users: usersData, loading: prevState.loading && false }));
    });

    const scheduleUnsubscribe = onSnapshot(doc(db, 'schedule', 'main'), (doc) => {
        if (doc.exists()) {
            const data = doc.data();
            setState(prevState => ({
            ...prevState,
            allCourses: data.allCourses || [],
            timeSlots: data.timeSlots || [],
            slotCourses: data.slotCourses || {},
            }));
        } else {
            setState(prevState => ({ ...prevState, allCourses: [], timeSlots: [], slotCourses: {} }));
        }
    });
    
    const categoriesUnsubscribe = onSnapshot(doc(db, 'schedule', 'categories'), (doc) => {
        if (doc.exists()) {
            const data = doc.data() as CategoryData;
            setState(prevState => ({
                ...prevState,
                teams: data.teams || [],
                positions: data.positions || [],
                subTeams: data.subTeams || {},
            }));
        } else {
            setState(prevState => ({ ...prevState, teams: [], positions: [], subTeams: {} }));
        }
    });

    // Initial load check
    Promise.all([getDoc(doc(db, 'schedule', 'main')), getDoc(doc(db, 'schedule', 'categories'))]).finally(() => {
        setState(prevState => ({ ...prevState, loading: false }));
    });

    return () => {
      usersUnsubscribe();
      scheduleUnsubscribe();
      categoriesUnsubscribe();
    };
  }, []);

  const addUser = async (user: User) => {
    try {
      const userDoc = doc(db, 'users', user.id);
      await setDoc(userDoc, user);
    } catch (error) {
      console.error("Error adding user:", error);
      throw error;
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      const userDoc = doc(db, 'users', userId);
      await deleteDoc(userDoc);
    } catch (error) {
      console.error("Error deleting user:", error);
    }
  };
  
  const clearAllUsers = async () => {
    try {
      const usersCollection = collection(db, 'users');
      const usersSnapshot = await getDocs(usersCollection);
      const batch = writeBatch(db);
      usersSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    } catch (error) {
      console.error("Error clearing all users:", error);
    }
  };

  return (
    <AppContext.Provider value={{ ...state, addUser, updateUser, deleteUser, clearAllUsers, setScheduleData, updateCategories }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
