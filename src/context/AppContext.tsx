
"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { collection, doc, onSnapshot, setDoc, deleteDoc, writeBatch, getDocs, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { User } from '@/app/types';

export type SlotCoursesIndex = Record<string, Record<string, string[]>>;
export type Schedule = { [day: string]: { [time: string]: string | undefined }; };

interface AppState {
  users: User[];
  allCourses: string[];
  timeSlots: string[];
  slotCourses: SlotCoursesIndex;
  loading: boolean;
}

interface AppContextType extends AppState {
  addUser: (user: User) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  clearAllUsers: () => Promise<void>;
  setScheduleData: (data: { slotCourses: SlotCoursesIndex; allCourses: string[]; timeSlots: string[]; }) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AppState>({
    users: [],
    allCourses: [],
    timeSlots: [],
    slotCourses: {},
    loading: true,
  });

  const setScheduleData = useCallback(async (data: { slotCourses: SlotCoursesIndex; allCourses: string[]; timeSlots: string[]; }) => {
    const { slotCourses, allCourses, timeSlots } = data;
    const scheduleDoc = doc(db, 'schedule', 'main');
    await setDoc(scheduleDoc, { slotCourses, allCourses, timeSlots });

    // This part can be slow, but it's important for data integrity.
    // It is now faster as it doesn't run in a batch with the schedule update.
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


  useEffect(() => {
    setState(prevState => ({ ...prevState, loading: true }));
    const scheduleDoc = doc(db, 'schedule', 'main');

    // First, fetch schedule data once to speed up initial load
    getDoc(scheduleDoc).then(docSnap => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setState(prevState => ({
          ...prevState,
          allCourses: data.allCourses || [],
          timeSlots: data.timeSlots || [],
          slotCourses: data.slotCourses || {},
        }));
      }
      // Regardless of existence, fetch users
      const usersCollection = collection(db, 'users');
      const usersUnsubscribe = onSnapshot(usersCollection, (snapshot) => {
        const usersData = snapshot.docs.map(doc => doc.data() as User);
        setState(prevState => ({ ...prevState, users: usersData, loading: false }));
      }, (error) => {
        console.error("Error fetching users:", error);
        setState(prevState => ({ ...prevState, loading: false }));
      });

      // After initial load, listen for real-time schedule updates
      const scheduleUnsubscribe = onSnapshot(scheduleDoc, (doc) => {
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
      
      return () => {
        usersUnsubscribe();
        scheduleUnsubscribe();
      };
    }).catch(error => {
      console.error("Error fetching initial schedule:", error);
      setState(prevState => ({ ...prevState, loading: false }));
    });
  }, []);

  const addUser = async (user: User) => {
    try {
      const userDoc = doc(db, 'users', user.id);
      await setDoc(userDoc, user);
    } catch (error) {
      console.error("Error adding user:", error);
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
    <AppContext.Provider value={{ ...state, addUser, deleteUser, clearAllUsers, setScheduleData }}>
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
