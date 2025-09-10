"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import type { User } from '@/app/types';

export type SlotCoursesIndex = Record<string, Record<string, string[]>>;
export type Schedule = { [day: string]: { [time: string]: string | undefined }; };

interface AppState {
  users: User[];
  allCourses: string[];
  timeSlots: string[];
  slotCourses: SlotCoursesIndex;
}

interface AppContextType extends AppState {
  addUser: (user: User) => void;
  deleteUser: (userId: string) => void;
  clearAllUsers: () => void;
  setScheduleData: (data: { slotCourses: SlotCoursesIndex; allCourses: string[]; timeSlots: string[]; }) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const isBrowser = typeof window !== 'undefined';

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AppState>(() => {
    if (!isBrowser) {
        return { users: [], allCourses: [], timeSlots: [], slotCourses: {} };
    }
    try {
      const item = window.localStorage.getItem('appState');
      return item ? JSON.parse(item) : { users: [], allCourses: [], timeSlots: [], slotCourses: {} };
    } catch (error) {
      console.error("Failed to parse state from localStorage", error);
      return { users: [], allCourses: [], timeSlots: [], slotCourses: {} };
    }
  });

  useEffect(() => {
    if (isBrowser) {
        try {
            window.localStorage.setItem('appState', JSON.stringify(state));
        } catch (error) {
            console.error("Failed to save state to localStorage", error);
        }
    }
  }, [state]);

  const addUser = (user: User) => {
    setState(prevState => ({ ...prevState, users: [...prevState.users, user] }));
  };

  const deleteUser = (userId: string) => {
    setState(prevState => ({ ...prevState, users: prevState.users.filter(user => user.id !== userId) }));
  };
  
  const clearAllUsers = () => {
    setState(prevState => ({ ...prevState, users: [] }));
  };

  const setScheduleData = (data: { slotCourses: SlotCoursesIndex; allCourses: string[]; timeSlots: string[]; }) => {
    const { slotCourses, allCourses, timeSlots } = data;
    setState(prevState => {
        // When schedule updates, filter out courses for each user that no longer exist
        const updatedUsers = prevState.users.map(user => ({
            ...user,
            courses: user.courses.filter(course => allCourses.includes(course)),
        }));

        return {
            ...prevState,
            slotCourses,
            allCourses,
            timeSlots,
            users: updatedUsers,
        };
    });
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
