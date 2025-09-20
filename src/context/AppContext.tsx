
"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useMemo } from 'react';
import { collection, doc, onSnapshot, setDoc, deleteDoc, writeBatch, getDocs, getDoc, updateDoc, query, where, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { User, CategoryData, UserRole, Position, Notification } from '@/app/types';
import { useAuth } from './AuthContext';

export type { User, CategoryData, UserRole, Position };
export type SlotCoursesIndex = Record<string, Record<string, string[]>>;
export type Schedule = { [day: string]: { [time: string]: string | undefined }; };

interface AppState extends CategoryData {
  users: User[];
  allCourses: string[];
  timeSlots: string[];
  slotCourses: SlotCoursesIndex;
  notifications: Notification[];
  loading: boolean;
  currentUserProfile: User | null;
  isUniversalAdmin: boolean;
  isExecutiveAdmin: boolean;
  isTeamAdmin: boolean;
  isSubTeamAdmin: boolean;
  hasAdminPrivileges: boolean;
}

interface AppContextType extends AppState {
  addUser: (user: User) => Promise<void>;
  updateUser: (userId: string, data: Partial<User>) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  canDeleteUser: (userToDelete: User) => boolean;
  canEditUser: (userToEdit: User) => boolean;
  clearAllUsers: () => Promise<void>;
  setScheduleData: (data: { slotCourses: SlotCoursesIndex; allCourses: string[]; timeSlots: string[]; }) => Promise<void>;
  updateCategories: (categories: CategoryData) => Promise<void>;
  markNotificationsAsRead: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const roleToLabel = (role: UserRole): string => {
  if (role === 'subTeam') return 'Sub-team Admin';
  if (role === 'none') return 'No Role';
  return `${capitalize(role)} Admin`;
}

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const { currentUser, isAdminBypass, loading: authLoading } = useAuth();

  const [state, setState] = useState<Omit<AppState, 'currentUserProfile' | 'isUniversalAdmin' | 'isExecutiveAdmin' | 'isTeamAdmin' | 'isSubTeamAdmin' | 'hasAdminPrivileges'>>({
    users: [],
    allCourses: [],
    timeSlots: [],
    slotCourses: {},
    teams: [],
    positions: [],
    subTeams: {},
    notifications: [],
    loading: true,
  });

  const currentUserProfile = useMemo(() => {
    if (isAdminBypass) {
        return {
             id: "admin-bypass-user",
             name: "Admin",
             nuId: "N/A",
             email: "admin@example.com",
             courses: [],
             teams: [],
             position: "N/A",
             offDays: [],
             role: 'universal',
             createdAt: Date.now()
        } as User;
    }
    return state.users.find(u => u.id === currentUser?.uid) ?? null;
  }, [currentUser, state.users, isAdminBypass]);

  const isUniversalAdmin = currentUserProfile?.role === 'universal';
  const isExecutiveAdmin = currentUserProfile?.role === 'executive';
  const isTeamAdmin = currentUserProfile?.role === 'team';
  const isSubTeamAdmin = currentUserProfile?.role === 'subTeam';
  const hasAdminPrivileges = isUniversalAdmin || isExecutiveAdmin || isTeamAdmin || isSubTeamAdmin;

  const canEditUser = useCallback((userToEdit: User) => {
    if (!currentUserProfile) return false;
    
    // Universal admin can edit anyone
    if (isUniversalAdmin) return true;
    
    // Admins cannot edit users with a higher or equal role
    const roleHierarchy = { 'none': 0, 'subTeam': 1, 'team': 2, 'executive': 3, 'universal': 4 };
    const adminRoleLevel = roleHierarchy[currentUserProfile.role || 'none'];
    const targetRoleLevel = roleHierarchy[userToEdit.role || 'none'];
    if (adminRoleLevel <= targetRoleLevel) return false;

    // Executive admins can edit users in their managed teams
    if (isExecutiveAdmin) {
        const managedTeams = currentUserProfile.teams || [];
        return !!userToEdit.team && managedTeams.includes(userToEdit.team);
    }
    
    // Team admins can edit users in their own team
    if (isTeamAdmin) {
        return userToEdit.team === currentUserProfile.team;
    }

    // Sub-team admins can edit users in their own sub-team
    if (isSubTeamAdmin) {
        return userToEdit.team === currentUserProfile.team && userToEdit.subTeam === currentUserProfile.subTeam;
    }

    return false;
  }, [currentUserProfile, isUniversalAdmin, isExecutiveAdmin, isTeamAdmin, isSubTeamAdmin]);

  const canDeleteUser = (userToDelete: User) => {
    if (!currentUser ) return false;
    // Prevent deleting self
    if (userToDelete.id === currentUser.uid) return false;
    
    return canEditUser(userToDelete);
  };
  
  const addNotification = useCallback(async (userId: string, title: string, message: string, link?: string) => {
    const notificationsCollection = collection(db, 'notifications');
    await addDoc(notificationsCollection, {
      userId,
      title,
      message,
      link: link || '/add-schedule', // Default link
      isRead: false,
      createdAt: Date.now(),
    });
  }, []);

  const markNotificationsAsRead = useCallback(async () => {
    if (!currentUser) return;
    const unreadNotifications = state.notifications.filter(n => !n.isRead);
    if (unreadNotifications.length === 0) return;

    const batch = writeBatch(db);
    unreadNotifications.forEach(n => {
        const notifRef = doc(db, 'notifications', n.id);
        batch.update(notifRef, { isRead: true });
    });
    await batch.commit();
  }, [currentUser, state.notifications]);

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
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    if (!userDoc.exists() || !currentUserProfile) return;

    const originalUserData = userDoc.data() as User;
    const originalRole = originalUserData.role || 'none';
    const newRole = data.role || originalRole;

    // Firestore does not accept undefined, so we need to clean the object
    const cleanedData = Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined)
    );
    await updateDoc(userDocRef, cleanedData);
    
    // If role has changed, send a notification
    if (newRole !== originalRole) {
      let message = `Your role has been set to ${roleToLabel(newRole)}.`;
      if (newRole === 'executive' && data.teams && data.teams.length > 0) {
        message += ` You can now manage the following teams: ${data.teams.join(', ')}.`;
      } else if (newRole === 'team') {
        message += ` You can now manage the ${originalUserData.team || data.team} team.`
      } else if (newRole === 'subTeam') {
        message += ` You can now manage the ${originalUserData.subTeam || data.subTeam} sub-team.`
      } else if (newRole === 'none') {
        message = 'Your administrative privileges have been removed.'
      }

      await addNotification(
        userId, 
        "Your Role Has Been Updated",
        `Updated by ${currentUserProfile.name}. ${message}`
      );
    }

  }, [currentUserProfile, addNotification]);


  useEffect(() => {
    let unsubs: (() => void)[] = [];
    setState(prevState => ({ ...prevState, loading: true }));
    
    unsubs.push(onSnapshot(collection(db, 'users'), (snapshot) => {
        const usersData = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                ...data,
                id: doc.id,
                createdAt: data.createdAt || 0,
            } as User;
        }).sort((a, b) => b.createdAt - a.createdAt); // Sort by most recent
        setState(prevState => ({ ...prevState, users: usersData }));
    }));

    unsubs.push(onSnapshot(doc(db, 'schedule', 'main'), (doc) => {
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
    }));
    
    unsubs.push(onSnapshot(doc(db, 'schedule', 'categories'), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data() as any;
            
            let positions: Position[] = data.positions || [];
            // One-time data migration for positions from string[] to Position[]
            if (positions.length > 0 && typeof positions[0] === 'string') {
                const migratedPositions: Position[] = (positions as unknown as string[]).map(name => ({
                    id: name.toLowerCase().replace(/\s+/g, '-') + '-migrated',
                    name: name,
                    icon: ''
                }));
                
                const categoryDoc = doc(db, 'schedule', 'categories');
                updateDoc(categoryDoc, { positions: migratedPositions });

                positions = migratedPositions;
            }

            setState(prevState => ({
                ...prevState,
                teams: data.teams || [],
                positions: positions,
                subTeams: data.subTeams || {},
            }));
        } else {
            setState(prevState => ({ ...prevState, teams: [], positions: [], subTeams: {} }));
        }
    }));
    
    if (currentUser?.uid) {
        const q = query(
            collection(db, "notifications"), 
            where("userId", "==", currentUser.uid)
        );
        unsubs.push(onSnapshot(q, (querySnapshot) => {
            const notificationsData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Notification)).sort((a, b) => b.createdAt - a.createdAt); // Sort client-side
            setState(prevState => ({ ...prevState, notifications: notificationsData }));
        }));
    } else {
        setState(prevState => ({ ...prevState, notifications: [] }));
    }


    Promise.all([
        getDocs(collection(db, 'users')), 
        getDoc(doc(db, 'schedule', 'main')), 
        getDoc(doc(db, 'schedule', 'categories'))
    ]).finally(() => {
        setState(prevState => ({ ...prevState, loading: false }));
    });

    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, [currentUser]);

  const addUser = async (user: User) => {
    try {
      const userDoc = doc(db, 'users', user.id);
      const userWithTimestamp = {
          ...user,
          createdAt: user.createdAt || Date.now(),
      }
      await setDoc(userDoc, userWithTimestamp);
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
  
  const value: AppContextType = {
      ...state,
      loading: state.loading || authLoading,
      currentUserProfile,
      isUniversalAdmin,
      isExecutiveAdmin,
      isTeamAdmin,
      isSubTeamAdmin,
      hasAdminPrivileges,
      addUser,
      updateUser,
      deleteUser,
      canDeleteUser,
      canEditUser,
      clearAllUsers,
      setScheduleData,
      updateCategories,
      markNotificationsAsRead,
  };

  return (
    <AppContext.Provider value={value}>
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
