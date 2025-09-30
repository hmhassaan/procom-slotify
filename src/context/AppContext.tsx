

"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useMemo } from 'react';
import { collection, doc, onSnapshot, setDoc, deleteDoc, writeBatch, getDocs, getDoc, updateDoc, query, where, addDoc, runTransaction } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { User, CategoryData, UserRole, Position, Notification, Meeting, MeetingAttendeeStatus, MeetingAttendee } from '@/app/types';
import { useAuth } from './AuthContext';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { format } from 'date-fns';
import { createCalendarEventFlow } from '@/ai/flows/create-calendar-event-flow';
import { deleteCalendarEventFlow } from '@/ai/flows/delete-calendar-event-flow';

export type { User, CategoryData, UserRole, Position, Notification, Meeting };
export type SlotCoursesIndex = Record<string, Record<string, string[]>>;
export type Schedule = { [day: string]: { [time: string]: string | undefined }; };

interface AppState extends CategoryData {
  users: User[];
  allCourses: string[];
  timeSlots: string[];
  slotCourses: SlotCoursesIndex;
  notifications: Notification[];
  meetings: Meeting[];
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
  canViewUser: (userToView: User) => boolean;
  canEditUser: (userToEdit: User) => boolean;
  setScheduleData: (data: { slotCourses: SlotCoursesIndex; allCourses: string[]; timeSlots: string[]; }) => Promise<void>;
  updateCategories: (categories: CategoryData) => Promise<void>;
  updateTeamName: (oldName: string, newName: string) => Promise<void>;
  updateSubTeamName: (parentTeam: string, oldName: string, newName: string) => Promise<void>;
  markNotificationsAsRead: () => Promise<void>;
  requestPushSubscription: () => Promise<void>;
  disablePushNotifications: () => Promise<void>;
  isPushSubscribed: boolean;
  createMeeting: (meetingData: { title: string; date: number; time: string; attendeeIds: string[] }) => Promise<void>;
  respondToMeeting: (meetingId: string, status: MeetingAttendeeStatus, reason?: string) => Promise<void>;
  deleteMeeting: (meetingId: string) => Promise<void>;
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
    meetings: [],
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
  
  const canViewUser = useCallback((userToView: User) => {
      if (!currentUserProfile) return false;
      if (userToView.id === currentUserProfile.id) return true;
      if (isUniversalAdmin) return true;
      if (isExecutiveAdmin && (currentUserProfile.teams || []).includes(userToView.team)) return true;
      if (isTeamAdmin && currentUserProfile.team === userToView.team) return true;
      if (isSubTeamAdmin && currentUserProfile.team === userToView.team && currentUserProfile.subTeam === userToView.subTeam) return true;

      const visibleTo = userToView.scheduleVisibleTo;
      if (visibleTo) {
          if (currentUserProfile.team && visibleTo.teams.includes(currentUserProfile.team)) return true;
          if (currentUserProfile.subTeam && visibleTo.subTeams.includes(currentUserProfile.subTeam)) return true;
      }
      return false;
  }, [currentUserProfile, isUniversalAdmin, isExecutiveAdmin, isTeamAdmin, isSubTeamAdmin]);

  const canEditUser = useCallback((userToEdit: User) => {
    if (!currentUserProfile) return false;
    if (isUniversalAdmin) return true;
    
    const roleHierarchy = { 'none': 0, 'subTeam': 1, 'team': 2, 'executive': 3, 'universal': 4 };
    const adminRoleLevel = roleHierarchy[currentUserProfile.role || 'none'];
    const targetRoleLevel = roleHierarchy[userToEdit.role || 'none'];
    if (adminRoleLevel <= targetRoleLevel) return false;

    if (isExecutiveAdmin) return !!userToEdit.team && (currentUserProfile.teams || []).includes(userToEdit.team);
    if (isTeamAdmin) return userToEdit.team === currentUserProfile.team;
    if (isSubTeamAdmin) return userToEdit.team === currentUserProfile.team && userToEdit.subTeam === currentUserProfile.subTeam;

    return false;
  }, [currentUserProfile, isUniversalAdmin, isExecutiveAdmin, isTeamAdmin, isSubTeamAdmin]);

  const canDeleteUser = (userToDelete: User) => {
    if (!currentUser ) return false;
    if (userToDelete.id === currentUser.uid) return false;
    return canEditUser(userToDelete);
  };
  
  const addNotification = useCallback(async (userId: string, title: string, message: string, link?: string) => {
    const notificationsCollection = collection(db, 'notifications');
    const newNotification: Omit<Notification, 'id'> = {
      userId, title, message, link: link || '/add-schedule', isRead: false, createdAt: Date.now(),
    };
    await addDoc(notificationsCollection, newNotification);

    try {
      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId, title, message, link: newNotification.link }),
      });
    } catch (e) { console.error('Failed to trigger web push:', e); }

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
        if (!n.id.startsWith('temp-')) batch.update(doc(db, 'notifications', n.id), { isRead: true });
    });
    await batch.commit();
     setState(prevState => ({ ...prevState, notifications: prevState.notifications.map(n => ({ ...n, isRead: true })) }));
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
            batch.update(doc(db, 'users', user.id), { courses: updatedCourses });
        }
    });
    await batch.commit();
  }, []);

  const updateCategories = useCallback(async (categories: CategoryData) => {
    await setDoc(doc(db, 'schedule', 'categories'), categories);
  }, []);

  const updateTeamName = useCallback(async (oldName: string, newName: string) => {
    await runTransaction(db, async (transaction) => {
        const categoryDocRef = doc(db, 'schedule', 'categories');
        const categoryDoc = await transaction.get(categoryDocRef);
        if (!categoryDoc.exists()) throw new Error("Categories document does not exist!");
        
        const categories = categoryDoc.data() as CategoryData;
        const teamIndex = categories.teams.indexOf(oldName);
        if (teamIndex === -1) throw new Error("Team not found");

        const newTeams = [...categories.teams]; newTeams[teamIndex] = newName;
        const newSubTeams = { ...categories.subTeams };
        if (newSubTeams[oldName]) { newSubTeams[newName] = newSubTeams[oldName]; delete newSubTeams[oldName]; }
        transaction.update(categoryDocRef, { teams: newTeams, subTeams: newSubTeams });

        const usersQuery = query(collection(db, "users"), where("team", "==", oldName));
        const usersSnapshot = await getDocs(usersQuery);
        usersSnapshot.forEach(userDoc => transaction.update(userDoc.ref, { team: newName }));
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

          const newSubTeamsForParent = [...categories.subTeams[parentTeam]]; newSubTeamsForParent[subTeamIndex] = newName;
          const newSubTeams = { ...categories.subTeams, [parentTeam]: newSubTeamsForParent };
          transaction.update(categoryDocRef, { subTeams: newSubTeams });

          const usersQuery = query(collection(db, "users"), where("team", "==", parentTeam), where("subTeam", "==", oldName));
          const usersSnapshot = await getDocs(usersQuery);
          usersSnapshot.forEach(userDoc => transaction.update(userDoc.ref, { subTeam: newName }));
      });
  }, []);

  const handleUserTeamChange = useCallback(async (updatedUser: User) => {
      const allAdmins = state.users.filter(u => u.role && u.role !== 'none');
      const notificationPromises = allAdmins.flatMap(admin => {
          const prefs = admin.notificationPreferences?.onUserJoin;
          if (!prefs) return [];
          const isTeamMatch = prefs.teams.includes(updatedUser.team) && !updatedUser.subTeam;
          const isSubTeamMatch = updatedUser.subTeam && prefs.subTeams.includes(updatedUser.subTeam);
          if (isTeamMatch || isSubTeamMatch) {
              const message = `${updatedUser.name} has just joined ${isSubTeamMatch ? `${updatedUser.team} > ${updatedUser.subTeam}` : updatedUser.team}.`;
              return [addNotification(admin.id, "New User Joined Team", message)];
          }
          return [];
      });
      await Promise.all(notificationPromises);
  }, [state.users, addNotification]);

  const updateUser = useCallback(async (userId: string, data: Partial<User>) => {
    const userDocRef = doc(db, 'users', userId);
    const userDocSnap = await getDoc(userDocRef);
    if (!userDocSnap.exists() || !currentUserProfile) return;

    const originalUserData = userDocSnap.data() as User;
    const cleanedData = Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
    await updateDoc(userDocRef, cleanedData);

    const updatedUser = { ...originalUserData, ...cleanedData };
    if ((data.team && data.team !== originalUserData.team) || (data.subTeam && data.subTeam !== originalUserData.subTeam)) {
        await handleUserTeamChange(updatedUser);
    }
    
    if (data.role && data.role !== originalUserData.role) {
      let message = `Your role has been set to ${roleToLabel(data.role)}.`;
      if (data.role === 'executive' && data.teams?.length) message += ` You can now manage: ${data.teams.join(', ')}.`;
      else if (data.role === 'team') message += ` You can now manage the ${updatedUser.team} team.`;
      else if (data.role === 'subTeam') message += ` You can now manage the ${updatedUser.subTeam} sub-team.`;
      else if (data.role === 'none') message = 'Your administrative privileges have been removed.';
      await addNotification(userId, "Your Role Has Been Updated", `Updated by ${currentUserProfile.name}. ${message}`);
    }
  }, [currentUserProfile, addNotification, handleUserTeamChange]);
  
  const createMeeting = useCallback(async (meetingData: { title: string; date: number; time: string; attendeeIds: string[] }) => {
    if (!currentUserProfile) throw new Error("User not authenticated");

    const allInvitedUserIds = [...new Set([currentUserProfile.id, ...meetingData.attendeeIds])];

    const attendees: MeetingAttendee[] = allInvitedUserIds.map(id => {
        const user = state.users.find(u => u.id === id);
        const status: MeetingAttendeeStatus = id === currentUserProfile.id ? 'accepted' : 'pending';
        return { userId: id, name: user?.name || 'Unknown User', status };
    });

    const newMeeting: Omit<Meeting, 'id'> = {
        title: meetingData.title,
        date: meetingData.date,
        time: meetingData.time,
        organizerId: currentUserProfile.id,
        organizerName: currentUserProfile.name,
        attendees,
        createdAt: Date.now()
    };

    const meetingRef = await addDoc(collection(db, 'meetings'), newMeeting);

    // Send in-app notifications
    const notificationPromises = meetingData.attendeeIds.map(attendeeId =>
        addNotification(
            attendeeId,
            "New Meeting Invitation",
            `You've been invited to "${meetingData.title}" by ${currentUserProfile.name} on ${format(new Date(meetingData.date), "EEE, MMM d")} at ${meetingData.time}.`,
            '/meetings'
        )
    );
    await Promise.all(notificationPromises);

    // Trigger Google Calendar event creation flow
    try {
        console.log("Triggering createCalendarEventFlow...");
        await createCalendarEventFlow({
            meetingId: meetingRef.id,
            title: meetingData.title,
            date: meetingData.date,
            time: meetingData.time,
            organizerId: currentUserProfile.id,
            attendeeIds: meetingData.attendeeIds
        });
        console.log("createCalendarEventFlow finished.");
    } catch (e) {
        console.error("Failed to create Google Calendar event:", e);
        // Don't throw, as the core meeting is already created. Maybe show a non-blocking toast.
    }
}, [currentUserProfile, state.users, addNotification]);
  
  const respondToMeeting = useCallback(async (meetingId: string, status: MeetingAttendeeStatus, reason?: string) => {
    if (!currentUserProfile) throw new Error("User not authenticated");
    
    const meetingRef = doc(db, 'meetings', meetingId);
    const meetingDoc = await getDoc(meetingRef);
    if (!meetingDoc.exists()) throw new Error("Meeting not found");
    
    const meeting = meetingDoc.data() as Meeting;
    const newAttendees = meeting.attendees.map(a => {
      if (a.userId === currentUserProfile.id) {
        return { ...a, status, responseReason: status === 'declined' ? reason : "" };
      }
      return a;
    });
    
    await updateDoc(meetingRef, { attendees: newAttendees });
    
    await addNotification(meeting.organizerId, "Meeting Response", `${currentUserProfile.name} has ${status} your invitation to "${meeting.title}".`, '/meetings');
  }, [currentUserProfile, addNotification]);
  
  const deleteMeeting = useCallback(async (meetingId: string) => {
    const meetingRef = doc(db, 'meetings', meetingId);
    const meetingDoc = await getDoc(meetingRef);
    if (!meetingDoc.exists()) throw new Error("Meeting not found");
    const meeting = meetingDoc.data() as Meeting;
    
    await deleteDoc(meetingRef);
    
    const notificationPromises = meeting.attendees
        .filter(a => a.userId !== currentUserProfile?.id)
        .map(attendee => 
            addNotification(attendee.userId, "Meeting Cancelled", `The meeting "${meeting.title}" on ${format(new Date(meeting.date), "EEE, MMM d")} at ${meeting.time} has been cancelled.`)
        );
    await Promise.all(notificationPromises);

    if (meeting.googleIcalUid) {
        try {
            console.log("Triggering deleteCalendarEventFlow...");
            await deleteCalendarEventFlow({
                googleIcalUid: meeting.googleIcalUid,
                attendeeIds: meeting.attendees.map(a => a.userId),
            });
            console.log("deleteCalendarEventFlow finished.");
        } catch (e) {
            console.error("Failed to delete Google Calendar event:", e);
        }
    }
  }, [addNotification, currentUserProfile]);

  useEffect(() => {
    let unsubs: (() => void)[] = [];
    setState(prevState => ({ ...prevState, loading: true }));
    
    unsubs.push(onSnapshot(collection(db, 'users'), (snapshot) => {
        const usersData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, createdAt: doc.data().createdAt || 0, googleRefreshToken: doc.data().googleRefreshToken || null } as User)).sort((a, b) => b.createdAt - a.createdAt);
        setState(prevState => ({ ...prevState, users: usersData }));
    }));

    unsubs.push(onSnapshot(doc(db, 'schedule', 'main'), (doc) => {
        if (doc.exists()) {
            const data = doc.data();
            setState(prevState => ({ ...prevState, allCourses: data.allCourses || [], timeSlots: data.timeSlots || [], slotCourses: data.slotCourses || {} }));
        } else {
            setState(prevState => ({ ...prevState, allCourses: [], timeSlots: [], slotCourses: {} }));
        }
    }));
    
    unsubs.push(onSnapshot(doc(db, 'schedule', 'categories'), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data() as any;
            let positions: Position[] = data.positions || [];
            if (positions.length > 0 && typeof positions[0] === 'string') {
                const migratedPositions: Position[] = (positions as unknown as string[]).map(name => ({ id: name.toLowerCase().replace(/\s+/g, '-') + '-migrated', name: name, icon: '' }));
                updateDoc(doc(db, 'schedule', 'categories'), { positions: migratedPositions });
                positions = migratedPositions;
            }
            setState(prevState => ({ ...prevState, teams: data.teams || [], positions: positions, subTeams: data.subTeams || {} }));
        } else {
            setState(prevState => ({ ...prevState, teams: [], positions: [], subTeams: {} }));
        }
    }));
    
    if (currentUser?.uid) {
        unsubs.push(onSnapshot(query(collection(db, "notifications"), where("userId", "==", currentUser.uid)), (snap) => {
            const notificationsData = snap.docs.map(d => ({ id: d.id, ...d.data() } as Notification)).sort((a, b) => b.createdAt - a.createdAt);
            setState(prevState => ({ ...prevState, notifications: notificationsData }));
        }));
        
        const meetingsQuery = query(collection(db, "meetings"), where("attendees", "array-contains", { userId: currentUser.uid, name: currentUser.displayName || "", status: "pending" }));
        
        const organizedMeetingsQuery = query(collection(db, "meetings"), where("organizerId", "==", currentUser.uid));
        
        const invitedMeetingsQuery = query(collection(db, 'meetings'), where('attendees', 'array-contains', { userId: currentUser.uid, status: 'pending', name: currentUser.displayName || '' }));


        const meetingsRef = collection(db, "meetings");
        const q = query(meetingsRef, where('attendees', 'array-contains', {userId: currentUser.uid}));

        const unsubMeetings = onSnapshot(collection(db, 'meetings'), (snapshot) => {
            const allMeetings: Meeting[] = [];
            snapshot.forEach(doc => {
                const meeting = { id: doc.id, ...doc.data() } as Meeting;
                if (meeting.organizerId === currentUser.uid || meeting.attendees.some(a => a.userId === currentUser.uid)) {
                    allMeetings.push(meeting);
                }
            });
            setState(prevState => ({ ...prevState, meetings: allMeetings.sort((a,b) => b.createdAt - a.createdAt) }));
        });
        unsubs.push(unsubMeetings);

    } else {
        setState(prevState => ({ ...prevState, notifications: [], meetings: [] }));
    }


    Promise.all([ getDocs(collection(db, 'users')), getDoc(doc(db, 'schedule', 'main')), getDoc(doc(db, 'schedule', 'categories')) ])
      .finally(() => setState(prevState => ({ ...prevState, loading: false })));

    return () => unsubs.forEach(unsub => unsub());
  }, [currentUser]);

  const addUser = async (user: User, isNewUser: boolean) => {
    try {
        const userDocRef = doc(db, 'users', user.id);
        let originalUser: User | null = null;
        if (!isNewUser) {
            const docSnap = await getDoc(userDocRef);
            if (docSnap.exists()) originalUser = docSnap.data() as User;
        }
        
        const userDataToSave = { ...user };
        // Ensure we don't accidentally wipe the refresh token on a normal profile update
        if (!isNewUser && originalUser?.googleRefreshToken && !userDataToSave.googleRefreshToken) {
            userDataToSave.googleRefreshToken = originalUser.googleRefreshToken;
        }

        const userWithTimestamp = { ...userDataToSave, createdAt: user.createdAt || Date.now() };
        await setDoc(userDocRef, userWithTimestamp, { merge: true });
        
        if (isNewUser || (originalUser && (originalUser.team !== user.team || originalUser.subTeam !== user.subTeam))) {
            await handleUserTeamChange(userWithTimestamp);
        }
    } catch (error) { console.error("Error adding/updating user:", error); throw error; }
  };

  const deleteUser = async (userToDelete: User) => {
    if (!currentUserProfile) throw new Error("Cannot delete user: current user profile not available.");
    try {
        const deletedRecord = { ...userToDelete, deletedAt: Date.now(), deletedBy: currentUserProfile.id, deletedByName: currentUserProfile.name };
        await setDoc(doc(db, 'deletedUsers', userToDelete.id), deletedRecord);
        await deleteDoc(doc(db, 'users', userToDelete.id));

        const subsSnapshot = await getDocs(collection(db, 'users', userToDelete.id, 'subscriptions'));
        const batch = writeBatch(db);
        subsSnapshot.forEach(subDoc => batch.delete(subDoc.ref));
        await batch.commit();
    } catch (error) { console.error("Error deleting user:", error); }
  };
  
  const value: AppContextType = {
      ...state,
      loading: state.loading || authLoading,
      currentUserProfile,
      isUniversalAdmin, isExecutiveAdmin, isTeamAdmin, isSubTeamAdmin, hasAdminPrivileges,
      addUser, updateUser, deleteUser, canDeleteUser, canViewUser, canEditUser,
      setScheduleData, updateCategories, updateTeamName, updateSubTeamName, markNotificationsAsRead,
      requestPushSubscription, disablePushNotifications, isPushSubscribed,
      createMeeting, respondToMeeting, deleteMeeting,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) throw new Error('useAppContext must be used within an AppProvider');
  return context;
};
