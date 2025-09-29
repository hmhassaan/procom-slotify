

export type Schedule = {
  [day: string]: { [time: string]: string | undefined };
};

export type UserRole = 'universal' | 'executive' | 'team' | 'subTeam' | 'none';

export type User = {
  id: string;
  name: string;
  nuId: string;
  email: string;
  courses: string[];
  // Team the user is a member of.
  team: string;
  // For executive roles, the teams they are allowed to manage.
  teams?: string[];
  subTeam?: string;
  position: string;
  offDays: string[];
  role?: UserRole;
  scheduleVisibleTo?: {
    teams: string[];
    subTeams: string[];
  };
  notificationPreferences?: {
    onUserJoin?: {
      teams: string[];
      subTeams: string[];
    };
  };
  // A timestamp for when the user was created, useful for sorting.
  createdAt: number; 
};

export type FreeSlots = {
  [day: string]: string[];
};

export type Position = {
  id: string;
  name: string;
  icon: string;
};

export type CategoryData = {
  teams: string[];
  positions: Position[];
  subTeams: Record<string, string[]>;
};

export type Notification = {
  id: string;
  userId: string;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: number;
};

