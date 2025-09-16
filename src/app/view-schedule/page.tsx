
"use client";

import { useState, useMemo, useEffect } from "react";
import { useAppContext } from "@/context/AppContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { User } from "@/app/types";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { MultiSelect } from "@/components/ui/multi-select";

const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const teams = ["ExCom/Core", "CS Competitions", "AI Competitions", "Web Development", "Automation"];
const positions = ["Executive", "Mentor", "Head", "Co-head", "Deputy Head", "Module Head", "Module Cohead", "Member"];

const isLab = (name: string) => /\blab\b/i.test(name);

export default function ViewSchedulePage() {
  const { users, timeSlots, slotCourses, loading } = useAppContext();
  const [teamFilters, setTeamFilters] = useState<string[]>([]);
  const [positionFilters, setPositionFilters] = useState<string[]>([]);
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push("/login");
    }
  }, [currentUser, authLoading, router]);

  const filteredUsers = useMemo(() => {
    return users.filter(user =>
      (teamFilters.length === 0 || teamFilters.includes(user.team)) &&
      (positionFilters.length === 0 || positionFilters.includes(user.position))
    );
  }, [users, teamFilters, positionFilters]);

  const availability = useMemo(() => {
    const availabilityData: Record<string, Record<string, { available: User[], unavailable: User[] }>> = {};

    weekdays.forEach(day => {
      availabilityData[day] = {};
      timeSlots.forEach(time => {
        availabilityData[day][time] = { available: [], unavailable: [] };
      });
    });

    if (filteredUsers.length === 0 || timeSlots.length === 0) {
      return availabilityData;
    }

    const userBusySlots: Record<string, Record<string, Set<string>>> = {};

    filteredUsers.forEach(user => {
      userBusySlots[user.id] = {};
      weekdays.forEach(day => {
        userBusySlots[user.id][day] = new Set<string>();

        if (user.offDays.includes(day)) {
          timeSlots.forEach(t => userBusySlots[user.id][day].add(t));
          return;
        }

        const dayIdx = slotCourses[day] || {};
        for (let i = 0; i < timeSlots.length; i++) {
          const time = timeSlots[i];
          const slotList = dayIdx[time] || [];
          const matches = slotList.filter(c => user.courses.includes(c));

          if (matches.length > 0) {
            const hasLab = matches.some(isLab);
            if (hasLab) {
              for (let j = i; j < Math.min(i + 3, timeSlots.length); j++) {
                userBusySlots[user.id][day].add(timeSlots[j]);
              }
            } else {
              userBusySlots[user.id][day].add(time);
            }
          }
        }
      });
    });

    weekdays.forEach(day => {
      timeSlots.forEach(time => {
        filteredUsers.forEach(user => {
          if (userBusySlots[user.id]?.[day]?.has(time)) {
            availabilityData[day][time].unavailable.push(user);
          } else {
            availabilityData[day][time].available.push(user);
          }
        });
      });
    });

    return availabilityData;
  }, [filteredUsers, timeSlots, slotCourses]);

  const isScheduleEmpty = timeSlots.length === 0;

  const pageLoading = loading || authLoading;

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading schedule...</p>
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Card>
        <CardHeader className="relative z-20">
          <CardTitle>Team Schedule</CardTitle>
          <div className="flex flex-col sm:flex-row gap-4 mt-4">
            <MultiSelect
              options={teams}
              selected={teamFilters}
              onChange={setTeamFilters}
              placeholder="Filter by team"
              className="w-full sm:w-[250px]"
            />
            <MultiSelect
              options={positions}
              selected={positionFilters}
              onChange={setPositionFilters}
              placeholder="Filter by position"
              className="w-full sm:w-[250px]"
            />
          </div>
        </CardHeader>
        <CardContent className="relative z-0">
          {isScheduleEmpty ? (
            <div className="text-center py-10 text-muted-foreground">
              <p>The schedule is not available yet. Please ask an admin to upload the timetable.</p>
            </div>
          ) : (
            <Tabs defaultValue="Monday">
              <TabsList>
                {weekdays.map(day => <TabsTrigger key={day} value={day}>{day}</TabsTrigger>)}
              </TabsList>
              {weekdays.map(day => (
                <TabsContent key={day} value={day} className="relative z-0">
                  <ScrollArea className="h-[60vh] relative z-0">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-1">
                      {timeSlots.map(time => (
                        <div key={time} className="p-4 border rounded-lg">
                          <h4 className="font-semibold border-b pb-2 mb-2">{time}</h4>
                          <div className="space-y-2">
                            <h5 className="font-medium text-green-600">Available</h5>
                            {availability[day]?.[time]?.available.length > 0 ? (
                              availability[day][time].available.map(user => (
                                <div key={user.id} className="text-sm p-1 bg-green-100 rounded">{user.name}</div>
                              ))
                            ) : <p className="text-xs text-muted-foreground">None</p>}
                          </div>
                          <div className="space-y-2 mt-4">
                            <h5 className="font-medium text-red-600">Unavailable</h5>
                            {availability[day]?.[time]?.unavailable.length > 0 ? (
                              availability[day][time].unavailable.map(user => (
                                <div key={user.id} className="text-sm p-1 bg-red-100 rounded">{user.name}</div>
                              ))
                            ) : <p className="text-xs text-muted-foreground">None</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>
              ))}
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
