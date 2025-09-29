

"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useMemo } from 'react';
import { collection, doc, onSnapshot, setDoc, deleteDoc, writeBatch, getDocs, getDoc, updateDoc, query, where, addDoc, runTransaction } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { User, CategoryData, UserRole, Position, Notification } from '@/app/types';
import { useAuth } from './AuthContext';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export type { User, CategoryData, UserRole, Position, Notification };
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
  addUser: (user: User, isNewUser: boolean) => Promise<void>;
  updateUser: (userId: string, data: Partial<User>) => Promise<void>;
  deleteUser: (userToDelete: User) => Promise<void>;
  canDeleteUser: (userToDelete: User) => boolean;
  canEditUser: (userToEdit: User) => boolean;
  setScheduleData: (data: { slotCourses: SlotCoursesIndex; allCourses: string[]; timeSlots: string[]; }) => Promise<void>;
  updateCategories: (categories: CategoryData) => Promise<void>;
  updateTeamName: (oldName: string, newName: string) => Promise<void>;
  updateSubTeamName: (parentTeam: string, oldName: string, newName: string) => Promise<void>;
  markNotificationsAsRead: () => Promise<void>;
  requestPushSubscription: () => Promise<void>;
  disablePushNotifications: () => Promise<void>;
  isPushSubscribed: boolean;
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
  const { isSubscribed: isPushSubscribed, requestSubscription: requestPushSubscription, unsubscribe: disablePushNotifications } = usePushNotifications();

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
    const newNotification = {
      userId,
      title,
      message,
      link: link || '/add-schedule', // Default link
      isRead: false,
      createdAt: Date.now(),
    };
    await addDoc(notificationsCollection, newNotification);

    // fire a web-push too
    try {
      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          userId,
          title,
          message,
          link: newNotification.link,
        }),
      });
    } catch (e) {
      console.error('Failed to trigger web push:', e);
    }


    // Also add to local state immediately if it's for the current user
    if (userId === currentUser?.uid) {
        setState(prevState => ({
            ...prevState,
            notifications: [{ ...newNotification, id: 'temp-' + Date.now() }, ...prevState.notifications].sort((a,b) => b.createdAt - a.createdAt),
        }));
    }
  }, [currentUser]);

  const markNotificationsAsRead = useCallback(async () => {
    if (!currentUser) return;
    const unreadNotifications = state.notifications.filter(n => !n.isRead);
    if (unreadNotifications.length === 0) return;

    const batch = writeBatch(db);
    unreadNotifications.forEach(n => {
        // Don't try to update temp notifications
        if (!n.id.startsWith('temp-')) {
            const notifRef = doc(db, 'notifications', n.id);
            batch.update(notifRef, { isRead: true });
        }
    });
    await batch.commit();

    // Also update local state
     setState(prevState => ({
        ...prevState,
        notifications: prevState.notifications.map(n => ({ ...n, isRead: true })),
    }));

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

  const updateTeamName = useCallback(async (oldName: string, newName: string) => {
    await runTransaction(db, async (transaction) => {
        const categoryDocRef = doc(db, 'schedule', 'categories');
        const categoryDoc = await transaction.get(categoryDocRef);
        if (!categoryDoc.exists()) throw new Error("Categories document does not exist!");
        
        const categories = categoryDoc.data() as CategoryData;
        const teamIndex = categories.teams.indexOf(oldName);
        if (teamIndex === -1) throw new Error("Team not found");

        // Update team name in categories
        const newTeams = [...categories.teams];
        newTeams[teamIndex] = newName;
        
        const newSubTeams = { ...categories.subTeams };
        if (newSubTeams[oldName]) {
            newSubTeams[newName] = newSubTeams[oldName];
            delete newSubTeams[oldName];
        }

        transaction.update(categoryDocRef, { teams: newTeams, subTeams: newSubTeams });

        // Find users with the old team name and update them
        const usersQuery = query(collection(db, "users"), where("team", "==", oldName));
        const usersSnapshot = await getDocs(usersQuery);
        
        usersSnapshot.forEach(userDoc => {
            transaction.update(userDoc.ref, { team: newName });
        });
    });
  }, []);
  
  const updateSubTeamName = useCallback(async (parentTeam: string, oldName: string, newName: string) => {
      await runTransaction(db, async (transaction) => {
          const categoryDocRef = doc(db, 'schedule', 'categories');
          const categoryDoc = await transaction.get(categoryDocRef);
          if (!categoryDoc.exists()) throw new Error("Categories document does not exist!");
          
          const categories = categoryDoc.data() as CategoryData;
          if (!categories.subTeams[parentTeam]) throw new Error("Parent team not found");

          const subTeamIndex = categories.subTeams[parentTeam].indexOf(oldName);
          if (subTeamIndex === -1) throw new Error("Sub-team not found");

          // Update sub-team name in categories
          const newSubTeamsForParent = [...categories.subTeams[parentTeam]];
          newSubTeamsForParent[subTeamIndex] = newName;
          const newSubTeams = { ...categories.subTeams, [parentTeam]: newSubTeamsForParent };
          
          transaction.update(categoryDocRef, { subTeams: newSubTeams });

          // Find users with the old sub-team name and update them
          const usersQuery = query(collection(db, "users"), where("team", "==", parentTeam), where("subTeam", "==", oldName));
          const usersSnapshot = await getDocs(usersQuery);

          usersSnapshot.forEach(userDoc => {
              transaction.update(userDoc.ref, { subTeam: newName });
          });
      });
  }, []);

  const handleUserTeamChange = useCallback(async (updatedUser: User) => {
      const allAdmins = state.users.filter(u => u.role && u.role !== 'none');
      const notificationPromises: Promise<void>[] = [];

      for (const admin of allAdmins) {
          const prefs = admin.notificationPreferences?.onUserJoin;
          if (!prefs) continue;

          const isTeamMatch = prefs.teams.includes(updatedUser.team) && !updatedUser.subTeam;
          const isSubTeamMatch = updatedUser.subTeam && prefs.subTeams.includes(updatedUser.subTeam);

          if (isTeamMatch || isSubTeamMatch) {
              const message = `${updatedUser.name} has just joined ${isSubTeamMatch ? `${updatedUser.team} > ${updatedUser.subTeam}` : updatedUser.team}.`;
              notificationPromises.push(addNotification(admin.id, "New User Joined Team", message));
          }
      }
      await Promise.all(notificationPromises);
  }, [state.users, addNotification]);

  const updateUser = useCallback(async (userId: string, data: Partial<User>) => {
    const userDocRef = doc(db, 'users', userId);
    const userDocSnap = await getDoc(userDocRef);
    if (!userDocSnap.exists() || !currentUserProfile) return;

    const originalUserData = userDocSnap.data() as User;
    const originalRole = originalUserData.role || 'none';
    const newRole = data.role || originalRole;

    const cleanedData = Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined)
    );
    
    const hasTeamChanged = data.team !== undefined && data.team !== originalUserData.team;
    const hasSubTeamChanged = data.subTeam !== undefined && data.subTeam !== originalUserData.subTeam;

    await updateDoc(userDocRef, cleanedData);

    const updatedUser = { ...originalUserData, ...cleanedData };

    if (hasTeamChanged || hasSubTeamChanged) {
        await handleUserTeamChange(updatedUser);
    }
    
    if (data.role && newRole !== originalRole) {
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
  }, [currentUserProfile, addNotification, handleUserTeamChange]);

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

  const addUser = async (user: User, isNewUser: boolean) => {
    try {
        const userDocRef = doc(db, 'users', user.id);
        
        let originalUser: User | null = null;
        if (!isNewUser) {
            const docSnap = await getDoc(userDocRef);
            if (docSnap.exists()) {
                originalUser = docSnap.data() as User;
            }
        }
        
        const userWithTimestamp = {
            ...user,
            createdAt: user.createdAt || Date.now(),
        };
        await setDoc(userDocRef, userWithTimestamp);

        const hasTeamChanged = originalUser && (originalUser.team !== user.team || originalUser.subTeam !== user.subTeam);

        if (isNewUser || hasTeamChanged) {
            await handleUserTeamChange(userWithTimestamp);
        }

    } catch (error) {
      console.error("Error adding/updating user:", error);
      throw error;
    }
  };

  const deleteUser = async (userToDelete: User) => {
    if (!currentUserProfile) {
        throw new Error("Cannot delete user: current user profile not available.");
    }
    try {
        const deletedUserDocRef = doc(db, 'deletedUsers', userToDelete.id);
        const userDocRef = doc(db, 'users', userToDelete.id);

        const deletedRecord = {
            ...userToDelete,
            deletedAt: Date.now(),
            deletedBy: currentUserProfile.id,
            deletedByName: currentUserProfile.name,
        };

        // Move to deletedUsers and then delete from users
        await setDoc(deletedUserDocRef, deletedRecord);
        await deleteDoc(userDocRef);

        // Also delete their subscriptions subcollection
        const subscriptionsCollection = collection(db, 'users', userToDelete.id, 'subscriptions');
        const subsSnapshot = await getDocs(subscriptionsCollection);
        const batch = writeBatch(db);
        subsSnapshot.forEach(subDoc => {
            batch.delete(subDoc.ref);
        });
        await batch.commit();

    } catch (error) {
        console.error("Error deleting user:", error);
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
      setScheduleData,
      updateCategories,
      updateTeamName,
      updateSubTeamName,
      markNotificationsAsRead,
      requestPushSubscription,
      disablePushNotifications,
      isPushSubscribed,
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
