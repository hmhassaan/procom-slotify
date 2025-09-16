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
  position: string;
  offDays: string[];
};

export type FreeSlots = {
  [day: string]: string[];
};
