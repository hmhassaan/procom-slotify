
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
  // `team` for single-team roles, `teams` for executive.
  team?: string;
  teams?: string[];
  subTeam?: string;
  position: string;
  offDays: string[];
  role?: UserRole;
};

export type FreeSlots = {
  [day: string]: string[];
};

export type CategoryData = {
  teams: string[];
  positions: string[];
  subTeams: Record<string, string[]>;
};
