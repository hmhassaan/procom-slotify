
"use client";

import { useState, useMemo, useEffect } from "react";
import { useAppContext } from "@/context/AppContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { User, Position } from "@/app/types";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { MultiSelect } from "@/components/ui/multi-select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const isLab = (name: string) => /\blab\b/i.test(name);

// Helper to get the current day for the tab default
const getCurrentDay = () => {
    const dayIndex = new Date().getDay(); // Sunday = 0, Monday = 1, etc.
    if (dayIndex === 0 || dayIndex === 6) { // Sunday or Saturday
        return "Monday";
    }
    return weekdays[dayIndex -1];
};


export default function ViewSchedulePage() {
  const { users, timeSlots, slotCourses, loading, teams, positions, subTeams, currentUserProfile, isUniversalAdmin, isExecutiveAdmin, isTeamAdmin, isSubTeamAdmin, hasAdminPrivileges } = useAppContext();
  const [teamFilters, setTeamFilters] = useState<string[]>([]);
  const [positionFilters, setPositionFilters] = useState<string[]>([]);
  const [subTeamFilters, setSubTeamFilters] = useState<string[]>([]);

  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push("/login");
    }
  }, [currentUser, authLoading, router]);

  const availableTeams = useMemo(() => {
    if (isUniversalAdmin) return teams;
    if (isExecutiveAdmin) return currentUserProfile?.teams || [];
    if (isTeamAdmin || isSubTeamAdmin) return currentUserProfile?.team ? [currentUserProfile.team] : [];
    // Regular user sees their team in the filter, but it won't show anyone else.
    return currentUserProfile?.team ? [currentUserProfile.team] : [];
  }, [teams, isUniversalAdmin, isExecutiveAdmin, isTeamAdmin, isSubTeamAdmin, currentUserProfile]);

  const availableSubTeams = useMemo(() => {
    const teamSelection = teamFilters.length > 0 ? teamFilters : availableTeams;

    const allSubTeams = Object.entries(subTeams)
        .filter(([team]) => teamSelection.includes(team))
        .flatMap(([, subs]) => subs);

    if (isSubTeamAdmin) {
        return currentUserProfile?.subTeam ? [currentUserProfile.subTeam] : [];
    }
    
    return allSubTeams;
  }, [teamFilters, subTeams, availableTeams, isSubTeamAdmin, currentUserProfile]);
  
  const positionOptions = useMemo(() => positions.map(p => p.name), [positions]);

  const filteredUsers = useMemo(() => {
    const self = currentUserProfile ? users.find(u => u.id === currentUserProfile.id) : null;
    let otherUsers: User[] = [];

    // Determine which users are potentially visible based on admin level
    if (isUniversalAdmin) {
        otherUsers = users;
    } else if (isExecutiveAdmin) {
        const execTeams = currentUserProfile?.teams || [];
        otherUsers = users.filter(user => execTeams.includes(user.team || ''));
    } else if (isTeamAdmin) {
        otherUsers = users.filter(user => user.team === currentUserProfile?.team);
    } else if (isSubTeamAdmin) {
        otherUsers = users.filter(user => user.team === currentUserProfile?.team && user.subTeam === currentUserProfile?.subTeam);
    }

    // Apply filters to the pool of "other" users
    const filteredOthers = otherUsers.filter(user =>
      (teamFilters.length === 0 || teamFilters.includes(user.team || '')) &&
      (positionFilters.length === 0 || positionFilters.includes(user.position)) &&
      (subTeamFilters.length === 0 || (user.subTeam && subTeamFilters.includes(user.subTeam)))
    );

    // Create a Set for quick lookups, and ensure the current user is always included
    const finalUserSet = new Set(filteredOthers);
    if (self) {
      finalUserSet.add(self);
    }
    
    return Array.from(finalUserSet);
  }, [users, teamFilters, positionFilters, subTeamFilters, isUniversalAdmin, isExecutiveAdmin, isTeamAdmin, isSubTeamAdmin, currentUserProfile]);
  
  const availability = useMemo(() => {
    const availabilityData: Record<string, Record<string, { available: User[], unavailable: User[] }>> = {};
    const positionOrder = new Map(positions.map((p, i) => [p.name, i]));

    const sortUsers = (userList: User[]) => {
      return userList.sort((a, b) => {
        const orderA = positionOrder.get(a.position) ?? 999;
        const orderB = positionOrder.get(b.position) ?? 999;
        if (orderA !== orderB) {
          return orderA - orderB;
        }
        return a.name.localeCompare(b.name);
      });
    };

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
        const slotAvailability = { available: [] as User[], unavailable: [] as User[] };
        filteredUsers.forEach(user => {
          if (userBusySlots[user.id]?.[day]?.has(time)) {
            slotAvailability.unavailable.push(user);
          } else {
            slotAvailability.available.push(user);
          }
        });
        
        availabilityData[day][time] = {
            available: sortUsers(slotAvailability.available),
            unavailable: sortUsers(slotAvailability.unavailable),
        };
      });
    });

    return availabilityData;
  }, [filteredUsers, timeSlots, slotCourses, positions]);
  
  const positionMap = useMemo(() => new Map(positions.map(p => [p.name, p.icon])), [positions]);


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
    <TooltipProvider>
      <div className="container mx-auto p-4 md:p-8">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Team Schedule</CardTitle>
            <CardDescription>
              View team availability based on selected filters. Your schedule is always visible.
            </CardDescription>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                <MultiSelect
                    options={availableTeams}
                    selected={teamFilters}
                    onChange={setTeamFilters}
                    placeholder="Filter by team..."
                    disabled={!hasAdminPrivileges}
                />
                <MultiSelect
                    options={availableSubTeams}
                    selected={subTeamFilters}
                    onChange={setSubTeamFilters}
                    placeholder="Filter by sub-team..."
                    disabled={!hasAdminPrivileges || availableSubTeams.length === 0}
                />
                <MultiSelect
                    options={positionOptions}
                    selected={positionFilters}
                    onChange={setPositionFilters}
                    placeholder="Filter by position..."
                    disabled={!hasAdminPrivileges}
                />
            </div>
          </CardHeader>
          <CardContent>
            {isScheduleEmpty ? (
              <div className="text-center py-10 text-muted-foreground">
                <p>The schedule is not available yet. Please ask an admin to upload the timetable.</p>
              </div>
            ) : (
              <Tabs defaultValue={getCurrentDay()}>
                <TabsList className="w-full justify-start overflow-x-auto">
                    {weekdays.map(day => <TabsTrigger key={day} value={day}>{day}</TabsTrigger>)}
                </TabsList>
                {weekdays.map(day => (
                  <TabsContent key={day} value={day} className="relative z-10">
                    <ScrollArea className="h-[60vh] -mx-6 px-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 py-4">
                        {timeSlots.map(time => (
                          <div key={time} className="border rounded-lg bg-card shadow-sm">
                            <div className="p-4 border-b">
                                <h4 className="font-semibold text-center text-sm">{time}</h4>
                            </div>
                            <div className="p-4 space-y-4">
                              <div>
                                <h5 className="font-medium text-sm text-green-600 mb-2">Available ({availability[day]?.[time]?.available.length})</h5>
                                <div className="space-y-2">
                                  {availability[day]?.[time]?.available.length > 0 ? (
                                    availability[day][time].available.map(user => (
                                      <Tooltip key={user.id} delayDuration={100}>
                                        <TooltipTrigger asChild>
                                          <Badge variant="outline" className="w-full justify-start font-normal bg-green-50 border-green-200 text-green-800">
                                             {positionMap.get(user.position) && <span className="mr-2">{positionMap.get(user.position)}</span>}
                                            {user.name}
                                          </Badge>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>{user.nuId}</p>
                                          <p>{user.team} {user.subTeam && `> ${user.subTeam}`}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    ))
                                  ) : <p className="text-xs text-muted-foreground italic">None available</p>}
                                </div>
                              </div>
                              <div >
                                <h5 className="font-medium text-sm text-red-600 mb-2">Unavailable ({availability[day]?.[time]?.unavailable.length})</h5>
                                 <div className="space-y-2">
                                    {availability[day]?.[time]?.unavailable.length > 0 ? (
                                    availability[day][time].unavailable.map(user => (
                                       <Tooltip key={user.id} delayDuration={100}>
                                        <TooltipTrigger asChild>
                                          <Badge variant="outline" className="w-full justify-start font-normal bg-red-50 border-red-200 text-red-800">
                                            {positionMap.get(user.position) && <span className="mr-2">{positionMap.get(user.position)}</span>}
                                            {user.name}
                                          </Badge>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>{user.nuId}</p>
                                          <p>{user.team} {user.subTeam && `> ${user.subTeam}`}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    ))
                                    ) : <p className="text-xs text-muted-foreground italic">All available</p>}
                                 </div>
                              </div>
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
    </TooltipProvider>
  );
}
