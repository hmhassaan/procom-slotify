
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { PlusCircle, Trash2, Filter } from "lucide-react";
import { Label } from "@/components/ui/label";

const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const isLab = (name: string) => /\blab\b/i.test(name);

// Helper to get the current day for the tab default
const getCurrentDay = () => {
    const dayIndex = new Date().getDay(); // Sunday = 0, Monday = 1, etc.
    if (dayIndex === 0 || dayIndex === 6) { // Sunday or Saturday
        return "Monday";
    }
    return weekdays[dayIndex - 1];
};

type AdvancedFilterGroup = {
  id: number;
  teams: string[];
  subTeams: string[];
  positions: string[];
};

type UnavailableInfo = User & { reason: string };

export default function ViewSchedulePage() {
  const { users, timeSlots, slotCourses, loading, teams, positions, subTeams, currentUserProfile, isUniversalAdmin, isExecutiveAdmin, isTeamAdmin, isSubTeamAdmin, hasAdminPrivileges } = useAppContext();
  const [teamFilters, setTeamFilters] = useState<string[]>([]);
  const [positionFilters, setPositionFilters] = useState<string[]>([]);
  const [subTeamFilters, setSubTeamFilters] = useState<string[]>([]);

  const [isAdvancedFilterOpen, setIsAdvancedFilterOpen] = useState(false);
  const [advancedFilterGroups, setAdvancedFilterGroups] = useState<AdvancedFilterGroup[]>([]);
  const [nextGroupId, setNextGroupId] = useState(1);

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
    if (!currentUserProfile) return [];

    const canViewUser = (targetUser: User): boolean => {
      // Users can always see themselves
      if (targetUser.id === currentUserProfile.id) return true;

      // Admins have broad visibility
      if (isUniversalAdmin) return true;
      if (isExecutiveAdmin && (currentUserProfile.teams || []).includes(targetUser.team)) return true;
      if (isTeamAdmin && currentUserProfile.team === targetUser.team) return true;
      if (isSubTeamAdmin && currentUserProfile.team === targetUser.team && currentUserProfile.subTeam === targetUser.subTeam) return true;
      
      // Check for explicit visibility grant
      const visibleTo = targetUser.scheduleVisibleTo;
      if (visibleTo) {
          if (currentUserProfile.team && visibleTo.teams.includes(currentUserProfile.team)) {
              return true;
          }
          if (currentUserProfile.subTeam && visibleTo.subTeams.includes(currentUserProfile.subTeam)) {
              return true;
          }
      }
      return false;
    };
    
    // First, get all users the current user is allowed to see
    const visibleUsers = users.filter(canViewUser);

    let filteredSet: User[];

    if (advancedFilterGroups.length > 0) {
        // Advanced Filter Logic (OR between groups)
        filteredSet = visibleUsers.filter(user => {
            return advancedFilterGroups.some(group => {
                const teamMatch = group.teams.length === 0 || group.teams.includes(user.team);
                const subTeamMatch = group.subTeams.length === 0 || (user.subTeam && group.subTeams.includes(user.subTeam));
                const positionMatch = group.positions.length === 0 || group.positions.includes(user.position);
                return teamMatch && subTeamMatch && positionMatch;
            });
        });

    } else {
        // Standard Filter Logic (AND between filters)
        filteredSet = visibleUsers.filter(user =>
            (teamFilters.length === 0 || teamFilters.includes(user.team || '')) &&
            (positionFilters.length === 0 || positionFilters.includes(user.position)) &&
            (subTeamFilters.length === 0 || (user.subTeam && subTeamFilters.includes(user.subTeam)))
        );
    }
    
    // Ensure the current user is always in the final list if they exist
    const finalUserSet = new Set(filteredSet);
    const self = users.find(u => u.id === currentUserProfile.id);
    if(self) {
        finalUserSet.add(self);
    }
    
    return Array.from(finalUserSet);
  }, [users, teamFilters, positionFilters, subTeamFilters, advancedFilterGroups, currentUserProfile, isUniversalAdmin, isExecutiveAdmin, isTeamAdmin, isSubTeamAdmin]);
  
  const availability = useMemo(() => {
    const availabilityData: Record<string, Record<string, { available: User[], unavailable: UnavailableInfo[] }>> = {};
    const positionOrder = new Map(positions.map((p, i) => [p.name, i]));

    const sortUsers = (userList: (User | UnavailableInfo)[]) => {
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

    const userBusySlots: Record<string, Record<string, { reason: string, slots: Set<string>}>> = {};

    filteredUsers.forEach(user => {
      userBusySlots[user.id] = {};
      weekdays.forEach(day => {
        userBusySlots[user.id][day] = { reason: "", slots: new Set<string>() };

        if (user.offDays.includes(day)) {
          timeSlots.forEach(t => userBusySlots[user.id][day].slots.add(t));
          userBusySlots[user.id][day].reason = "Off Day";
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
              // For a lab, block the next 2 slots as well (total 3)
              for (let j = i; j < Math.min(i + 3, timeSlots.length); j++) {
                 const labTime = timeSlots[j];
                 // Avoid overwriting a different class's reason
                 if (!userBusySlots[user.id][day].slots.has(labTime)) {
                    userBusySlots[user.id][day].slots.add(labTime);
                    userBusySlots[user.id][day].reason = matches[0];
                 }
              }
            } else {
              userBusySlots[user.id][day].slots.add(time);
              userBusySlots[user.id][day].reason = matches[0];
            }
          }
        }
      });
    });

    weekdays.forEach(day => {
      timeSlots.forEach(time => {
        const slotAvailability = { available: [] as User[], unavailable: [] as UnavailableInfo[] };
        const dayIdx = slotCourses[day] || {};

        filteredUsers.forEach(user => {
          if (user.offDays.includes(day)) {
            slotAvailability.unavailable.push({ ...user, reason: "Off Day" });
            return;
          }

          const slotCoursesForTime = dayIdx[time] || [];
          const userCoursesInSlot = user.courses.filter(c => slotCoursesForTime.includes(c));
          
          let isBusy = false;
          let busyReason = "";

          // Check if busy due to a lab starting earlier
           for (let i = Math.max(0, timeSlots.indexOf(time) - 2); i < timeSlots.indexOf(time); i++) {
                const prevTime = timeSlots[i];
                const prevSlotCourses = dayIdx[prevTime] || [];
                const matchingPrevCourses = user.courses.filter(c => prevSlotCourses.includes(c));
                if (matchingPrevCourses.some(isLab)) {
                    isBusy = true;
                    busyReason = matchingPrevCourses.find(isLab) || matchingPrevCourses[0];
                    break;
                }
           }

          if (!isBusy && userCoursesInSlot.length > 0) {
              isBusy = true;
              busyReason = userCoursesInSlot[0];
          }

          if (isBusy) {
            slotAvailability.unavailable.push({ ...user, reason: busyReason });
          } else {
            slotAvailability.available.push(user);
          }
        });
        
        availabilityData[day][time] = {
            available: sortUsers(slotAvailability.available) as User[],
            unavailable: sortUsers(slotAvailability.unavailable) as UnavailableInfo[],
        };
      });
    });

    return availabilityData;
  }, [filteredUsers, timeSlots, slotCourses, positions]);
  
  const positionMap = useMemo(() => new Map(positions.map(p => [p.name, p.icon])), [positions]);


  const isScheduleEmpty = timeSlots.length === 0;

  const pageLoading = loading || authLoading;

  // Advanced Filter Dialog Functions
  const addFilterGroup = () => {
    setAdvancedFilterGroups(prev => [...prev, { id: nextGroupId, teams: [], subTeams: [], positions: [] }]);
    setNextGroupId(prev => prev + 1);
  };

  const removeFilterGroup = (id: number) => {
    setAdvancedFilterGroups(prev => prev.filter(group => group.id !== id));
  };

  const updateFilterGroup = (id: number, field: keyof Omit<AdvancedFilterGroup, 'id'>, value: string[]) => {
    setAdvancedFilterGroups(prev => prev.map(group =>
      group.id === id ? { ...group, [field]: value } : group
    ));
  };

  const clearAdvancedFilters = () => {
    setAdvancedFilterGroups([]);
  };

  const isAdvancedFilterActive = advancedFilterGroups.length > 0;

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
        <Card className="overflow-hidden shadow-lg">
          <CardHeader>
            <CardTitle className="text-3xl font-bold tracking-tight">Team Schedule</CardTitle>
            <CardDescription className="text-lg text-muted-foreground">
              View team availability based on selected filters. Your schedule is always visible.
            </CardDescription>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-6">
                <MultiSelect
                    options={availableTeams}
                    selected={teamFilters}
                    onChange={setTeamFilters}
                    placeholder="Filter by team..."
                    disabled={!hasAdminPrivileges || isAdvancedFilterActive}
                />
                <MultiSelect
                    options={availableSubTeams}
                    selected={subTeamFilters}
                    onChange={setSubTeamFilters}
                    placeholder="Filter by sub-team..."
                    disabled={!hasAdminPrivileges || availableSubTeams.length === 0 || isAdvancedFilterActive}
                />
                <MultiSelect
                    options={positionOptions}
                    selected={positionFilters}
                    onChange={setPositionFilters}
                    placeholder="Filter by position..."
                    disabled={isAdvancedFilterActive}
                />
                 <Dialog open={isAdvancedFilterOpen} onOpenChange={setIsAdvancedFilterOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" className="gap-2">
                            <Filter className="h-4 w-4" />
                            Advanced Filters {isAdvancedFilterActive && `(${advancedFilterGroups.length})`}
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl">
                        <DialogHeader>
                            <DialogTitle>Advanced Filters</DialogTitle>
                            <CardDescription>
                                Show users who match ANY of the following groups. Within each group, users must match ALL criteria selected.
                            </CardDescription>
                        </DialogHeader>
                        <ScrollArea className="max-h-[60vh] p-1">
                            <div className="space-y-4 p-4">
                                {advancedFilterGroups.map((group, index) => {
                                    const availableSubTeamsForGroup = Object.entries(subTeams)
                                        .filter(([team]) => group.teams.length === 0 || group.teams.includes(team))
                                        .flatMap(([, subs]) => subs);
                                    return (
                                        <div key={group.id} className="p-4 border rounded-lg space-y-3 relative">
                                            <Label className="font-semibold text-muted-foreground">Filter Group {index + 1}</Label>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div className="space-y-1">
                                                    <Label>Team(s)</Label>
                                                    <MultiSelect
                                                        options={availableTeams}
                                                        selected={group.teams}
                                                        onChange={(value) => updateFilterGroup(group.id, 'teams', value)}
                                                        placeholder="Any Team"
                                                        disabled={!hasAdminPrivileges}
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label>Sub-team(s)</Label>
                                                     <MultiSelect
                                                        options={availableSubTeamsForGroup}
                                                        selected={group.subTeams}
                                                        onChange={(value) => updateFilterGroup(group.id, 'subTeams', value)}
                                                        placeholder="Any Sub-team"
                                                        disabled={!hasAdminPrivileges || availableSubTeamsForGroup.length === 0}
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label>Position(s)</Label>
                                                     <MultiSelect
                                                        options={positionOptions}
                                                        selected={group.positions}
                                                        onChange={(value) => updateFilterGroup(group.id, 'positions', value)}
                                                        placeholder="Any Position"
                                                    />
                                                </div>
                                            </div>
                                            <Button variant="ghost" size="icon" className="absolute top-2 right-2" onClick={() => removeFilterGroup(group.id)}>
                                                <Trash2 className="w-4 h-4 text-destructive" />
                                            </Button>
                                        </div>
                                    );
                                })}
                                <Button variant="outline" className="w-full" onClick={addFilterGroup}>
                                    <PlusCircle className="mr-2 h-4 w-4" /> Add Filter Group
                                </Button>
                            </div>
                        </ScrollArea>
                        <DialogFooter className="sm:justify-between items-center gap-2">
                             <Button variant="destructive" onClick={clearAdvancedFilters} disabled={!isAdvancedFilterActive}>
                                Clear All Advanced Filters
                            </Button>
                            <Button onClick={() => setIsAdvancedFilterOpen(false)}>Close</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {isScheduleEmpty ? (
              <div className="text-center py-16 text-muted-foreground">
                <p className="text-lg">The schedule is not available yet.</p>
                <p>Please ask an admin to upload the timetable.</p>
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
                          <div key={time} className="border rounded-xl bg-card shadow-md transition-shadow hover:shadow-xl">
                            <div className="p-3 border-b bg-muted/50 rounded-t-xl">
                                <h4 className="font-semibold text-center text-sm">{time}</h4>
                            </div>
                            <div className="p-3 space-y-3">
                              <div>
                                <h5 className="font-bold text-sm text-green-600 mb-2">Available ({availability[day]?.[time]?.available.length})</h5>
                                <div className="space-y-2">
                                  {availability[day]?.[time]?.available.length > 0 ? (
                                    availability[day][time].available.map(user => (
                                      <Tooltip key={user.id} delayDuration={100}>
                                        <TooltipTrigger asChild>
                                           <div className="flex items-center gap-2 p-1.5 rounded-md bg-green-50 hover:bg-green-100 transition-colors">
                                              <span className="text-lg w-6 text-center">{positionMap.get(user.position)}</span>
                                              <span className="text-sm font-medium text-green-800">{user.name}</span>
                                           </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p className="font-semibold">{user.position} {positionMap.get(user.position)}</p>
                                          <p>{user.nuId}</p>
                                          <p>{user.team} {user.subTeam && `> ${user.subTeam}`}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    ))
                                  ) : <p className="text-xs text-muted-foreground italic text-center py-2">None</p>}
                                </div>
                              </div>
                              <div>
                                <h5 className="font-bold text-sm text-red-600 mb-2">Unavailable ({availability[day]?.[time]?.unavailable.length})</h5>
                                 <div className="space-y-2">
                                    {availability[day]?.[time]?.unavailable.length > 0 ? (
                                    availability[day][time].unavailable.map(user => (
                                       <Tooltip key={user.id} delayDuration={100}>
                                        <TooltipTrigger asChild>
                                           <div className="flex items-center gap-2 p-1.5 rounded-md bg-red-50 hover:bg-red-100 transition-colors">
                                               <span className="text-lg w-6 text-center">{positionMap.get(user.position)}</span>
                                              <span className="text-sm font-medium text-red-800">{user.name}</span>
                                           </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p className="font-semibold">{user.position} {positionMap.get(user.position)}</p>
                                          <p>{user.nuId}</p>
                                          <p>{user.team} {user.subTeam && `> ${user.subTeam}`}</p>
                                          <p className="text-red-500">{user.reason}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    ))
                                    ) : <p className="text-xs text-muted-foreground italic text-center py-2">None</p>}
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

    