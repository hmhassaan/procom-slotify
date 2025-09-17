export type Schedule = {
  [day: string]: { [time: string]: string | undefined };
};

export type User = {
  id: string;
  name: string;
  nuId: string;
  email: string;
  courses: string[];
  team: string;
  subTeam?: string;
  position: string;
  offDays: string[];
};

export type FreeSlots = {
  [day: string]: string[];
};

export type CategoryData = {
  teams: string[];
  positions: string[];
  subTeams: Record<string, string[]>;
};
