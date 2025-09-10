export type Schedule = {
  [day: string]: { [time: string]: string | undefined };
};

export type User = {
  id: string;
  name: string;
  courses: string[];
};

export type FreeSlots = {
  [day: string]: string[];
};
