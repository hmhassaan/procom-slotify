
"use client";

import { useState, useMemo, useEffect } from "react";
import { useAppContext } from "@/context/AppContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { User } from "@/app/types";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { MultiSelect } from "@/components/ui/multi-select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const isLab = (name: string) => /\blab\b/i.test(name);

export default function ViewSchedulePage() {
  const { users, timeSlots, slotCourses, loading, teams, positions, subTeams } = useAppContext();
  const [teamFilters, setTeamFilters] = useState<string[]>([]);
  const [positionFilters, setPositionFilters] = useState<string[]>([]);
  const [subTeamFilters, setSubTeamFilters] = useState<string[]>([]);

  const { currentUser, currentUserProfile, isUniversalAdmin, isExecutiveAdmin, isTeamAdmin, isSubTeamAdmin, hasAdminPrivileges, loading: authLoading } = useAuth();
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
    return [];
  }, [teams, isUniversalAdmin, isExecutiveAdmin, isTeamAdmin, isSubTeamAdmin, currentUserProfile]);

  const availableSubTeams = useMemo(() => {
    const allSubTeams = Object.entries(subTeams)
        .filter(([team]) => teamFilters.length === 0 || teamFilters.includes(team))
        .flatMap(([, subs]) => subs);

    if (isUniversalAdmin) {
        return allSubTeams;
    }
    if (isExecutiveAdmin) {
        const execTeams = currentUserProfile?.teams || [];
        return Object.entries(subTeams)
            .filter(([team]) => execTeams.includes(team))
            .flatMap(([, subs]) => subs);
    }
    if (isTeamAdmin) {
        const team = currentUserProfile?.team;
        if (!team) return [];
        return subTeams[team] || [];
    }
    if (isSubTeamAdmin) {
        return currentUserProfile?.subTeam ? [currentUserProfile.subTeam] : [];
    }
    return [];
  }, [teamFilters, subTeams, isUniversalAdmin, isExecutiveAdmin, isTeamAdmin, isSubTeamAdmin, currentUserProfile]);

  const filteredUsers = useMemo(() => {
    let usersToFilter: User[] = [];

    if (isUniversalAdmin) {
        usersToFilter = users;
    } else if (isExecutiveAdmin) {
        const execTeams = currentUserProfile?.teams || [];
        usersToFilter = users.filter(user => execTeams.includes(user.team || ''));
    } else if (isTeamAdmin) {
        usersToFilter = users.filter(user => user.team === currentUserProfile?.team);
    } else if (isSubTeamAdmin) {
        usersToFilter = users.filter(user => user.team === currentUserProfile?.team && user.subTeam === currentUserProfile?.subTeam);
    } else {
        // Regular user sees only themselves
        usersToFilter = users.filter(user => user.id === currentUserProfile?.id);
    }

    return usersToFilter.filter(user =>
      (teamFilters.length === 0 || teamFilters.includes(user.team || '')) &&
      (positionFilters.length === 0 || positionFilters.includes(user.position)) &&
      (subTeamFilters.length === 0 || (user.subTeam && subTeamFilters.includes(user.subTeam)))
    );
  }, [users, teamFilters, positionFilters, subTeamFilters, isUniversalAdmin, isExecutiveAdmin, isTeamAdmin, isSubTeamAdmin, currentUserProfile]);
  
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
    <TooltipProvider>
      <div className="container mx-auto p-4 md:p-8">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Team Schedule</CardTitle>
            <CardDescription>
              View team availability based on selected filters.
            </CardDescription>
            {hasAdminPrivileges && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                  <MultiSelect
                      options={availableTeams}
                      selected={teamFilters}
                      onChange={setTeamFilters}
                      placeholder="Filter by team..."
                  />
                  <MultiSelect
                      options={availableSubTeams}
                      selected={subTeamFilters}
                      onChange={setSubTeamFilters}
                      placeholder="Filter by sub-team..."
                  />
                  <MultiSelect
                      options={positions}
                      selected={positionFilters}
                      onChange={setPositionFilters}
                      placeholder="Filter by position..."
                  />
              </div>
            )}
          </CardHeader>
          <CardContent>
            {isScheduleEmpty ? (
              <div className="text-center py-10 text-muted-foreground">
                <p>The schedule is not available yet. Please ask an admin to upload the timetable.</p>
              </div>
            ) : (
              <Tabs defaultValue="Monday">
                <div className="overflow-x-auto">
                    <TabsList className="w-full sm:w-auto">
                        {weekdays.map(day => <TabsTrigger key={day} value={day}>{day}</TabsTrigger>)}
                    </TabsList>
                </div>
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
                                            {user.name}
                                          </Badge>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>{user.nuId}</p>
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
                                            {user.name}
                                          </Badge>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>{user.nuId}</p>
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
