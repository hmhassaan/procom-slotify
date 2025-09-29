

"use client";

import { useState, useMemo, useEffect } from "react";
import { useAppContext } from "@/context/AppContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { User, Position, Meeting } from "@/app/types";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { MultiSelect } from "@/components/ui/multi-select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { PlusCircle, Trash2, Filter, Star, ChevronDown, CalendarPlus, Check } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

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

type SlotInfo = {
  day: string;
  time: string;
  availableCount: number;
  totalCount: number;
};

const useViewSchedule = () => {
    const { users, currentUserProfile, canViewUser } = useAppContext();
    const [teamFilters, setTeamFilters] = useState<string[]>([]);
    const [positionFilters, setPositionFilters] = useState<string[]>([]);
    const [subTeamFilters, setSubTeamFilters] = useState<string[]>([]);
    const [advancedFilterGroups, setAdvancedFilterGroups] = useState<AdvancedFilterGroup[]>([]);

    const filteredUsers = useMemo(() => {
        if (!currentUserProfile) return [];
        const visibleUsers = users.filter(canViewUser);

        let filteredSet: User[];

        if (advancedFilterGroups.length > 0) {
            filteredSet = visibleUsers.filter(user =>
                advancedFilterGroups.some(group =>
                    (group.teams.length === 0 || group.teams.includes(user.team)) &&
                    (group.subTeams.length === 0 || (user.subTeam && group.subTeams.includes(user.subTeam))) &&
                    (group.positions.length === 0 || group.positions.includes(user.position))
                )
            );
        } else {
            filteredSet = visibleUsers.filter(user =>
                (teamFilters.length === 0 || teamFilters.includes(user.team || '')) &&
                (positionFilters.length === 0 || positionFilters.includes(user.position)) &&
                (subTeamFilters.length === 0 || (user.subTeam && subTeamFilters.includes(user.subTeam)))
            );
        }

        const finalUserSet = new Set(filteredSet);
        const self = users.find(u => u.id === currentUserProfile.id);
        if (self) finalUserSet.add(self);

        return Array.from(finalUserSet);
    }, [users, teamFilters, positionFilters, subTeamFilters, advancedFilterGroups, currentUserProfile, canViewUser]);

    return {
        filteredUsers,
        teamFilters, setTeamFilters,
        positionFilters, setPositionFilters,
        subTeamFilters, setSubTeamFilters,
        advancedFilterGroups, setAdvancedFilterGroups,
    };
};


const ScheduleMeetingDialog = ({ day, time }: { day: string, time: string }) => {
  const { users, currentUserProfile, createMeeting, canViewUser, teams, subTeams, positions } = useAppContext();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  
  const { filteredUsers } = useViewSchedule();
  
  useEffect(() => {
    if (isOpen) {
      const defaultSelectedIds = filteredUsers
          .filter(u => u.id !== currentUserProfile?.id)
          .map(u => u.id);
      setSelectedUserIds(defaultSelectedIds);
      setMeetingTitle("");
    }
  }, [isOpen, filteredUsers, currentUserProfile]);

  const handleCreateMeeting = async () => {
    if (!meetingTitle.trim()) {
      toast({ variant: "destructive", title: "Title is required" });
      return;
    }
    if (selectedUserIds.length === 0) {
      toast({ variant: "destructive", title: "Select at least one member" });
      return;
    }
    if (!currentUserProfile) return;

    try {
      await createMeeting({
        title: meetingTitle,
        day,
        time,
        attendeeIds: selectedUserIds,
      });
      toast({ title: "Meeting Scheduled", description: "Invitations have been sent." });
      setIsOpen(false);
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Error", description: "Could not schedule meeting." });
    }
  };

  const inviteeListStructure = useMemo(() => {
    const allVisibleUsers = users.filter(u => canViewUser(u) && u.id !== currentUserProfile?.id);
    const positionOrder = new Map(positions.map((p, i) => [p.name, i]));
    const sortUsers = (userList: User[]) => {
      return userList.sort((a, b) => {
        const orderA = positionOrder.get(a.position) ?? 999;
        const orderB = positionOrder.get(b.position) ?? 999;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
      });
    };

    return teams.map(team => {
        const teamUsers = allVisibleUsers.filter(u => u.team === team);
        const teamSubTeams = subTeams[team] || [];
        const usersInNoSubTeam = teamUsers.filter(u => !u.subTeam);

        const subTeamsWithUsers = teamSubTeams.map(subTeamName => ({
            name: subTeamName,
            users: sortUsers(teamUsers.filter(u => u.subTeam === subTeamName))
        }));

        return {
            name: team,
            usersInNoSubTeam: sortUsers(usersInNoSubTeam),
            subTeams: subTeamsWithUsers,
        }
    }).filter(team => team.usersInNoSubTeam.length > 0 || team.subTeams.some(st => st.users.length > 0));

  }, [users, teams, subTeams, positions, canViewUser, currentUserProfile]);

  if (!currentUserProfile) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="w-full mt-2 gap-2"><CalendarPlus /> Schedule Meeting</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Schedule a Meeting</DialogTitle>
          <DialogDescription>For {day} at {time}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="meeting-title">Meeting Title</Label>
            <Input id="meeting-title" value={meetingTitle} onChange={(e) => setMeetingTitle(e.target.value)} />
          </div>
          <div>
            <Label>Invite Members</Label>
            <ScrollArea className="h-60 border rounded-md p-4">
              <div className="space-y-4">
                {inviteeListStructure.map(team => (
                  <div key={team.name}>
                    <h3 className="font-semibold text-sm border-b mb-2 pb-1">{team.name}</h3>
                    <div className="space-y-2">
                       {team.usersInNoSubTeam.map(user => (
                          <div key={user.id} className="flex items-center gap-2">
                            <Checkbox id={`invite-${user.id}`} checked={selectedUserIds.includes(user.id)} onCheckedChange={(checked) => setSelectedUserIds(prev => checked ? [...prev, user.id] : prev.filter(id => id !== user.id))} />
                            <Label htmlFor={`invite-${user.id}`}>{user.name} - {user.position}</Label>
                          </div>
                        ))}
                       {team.subTeams.map(subTeam => (
                          <div key={subTeam.name} className="pl-4 pt-2">
                              <h4 className="font-medium text-xs text-muted-foreground mb-1">{subTeam.name}</h4>
                              <div className="space-y-2">
                                  {subTeam.users.map(user => (
                                      <div key={user.id} className="flex items-center gap-2">
                                          <Checkbox id={`invite-${user.id}`} checked={selectedUserIds.includes(user.id)} onCheckedChange={(checked) => setSelectedUserIds(prev => checked ? [...prev, user.id] : prev.filter(id => id !== user.id))} />
                                          <Label htmlFor={`invite-${user.id}`}>{user.name} - {user.position}</Label>
                                      </div>
                                  ))}
                              </div>
                          </div>
                       ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateMeeting}>Create Meeting & Notify</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default function ViewSchedulePage() {
  const { users, timeSlots, slotCourses, loading, teams, positions, subTeams, currentUserProfile, isUniversalAdmin, isExecutiveAdmin, isTeamAdmin, isSubTeamAdmin, hasAdminPrivileges, meetings, canViewUser } = useAppContext();
  const { teamFilters, setTeamFilters, positionFilters, setPositionFilters, subTeamFilters, setSubTeamFilters, advancedFilterGroups, setAdvancedFilterGroups, filteredUsers } = useViewSchedule();
  
  const [nextGroupId, setNextGroupId] = useState(1);
  const [isAdvancedFilterOpen, setIsAdvancedFilterOpen] = useState(false);

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
    return currentUserProfile?.team ? [currentUserProfile.team] : [];
  }, [teams, isUniversalAdmin, isExecutiveAdmin, isTeamAdmin, isSubTeamAdmin, currentUserProfile]);

  const availableSubTeams = useMemo(() => {
    const teamSelection = teamFilters.length > 0 ? teamFilters : availableTeams;
    const allSubTeams = Object.entries(subTeams)
        .filter(([team]) => teamSelection.includes(team))
        .flatMap(([, subs]) => subs);
    if (isSubTeamAdmin && !isTeamAdmin) return currentUserProfile?.subTeam ? [currentUserProfile.subTeam] : [];
    return allSubTeams;
  }, [teamFilters, subTeams, availableTeams, isSubTeamAdmin, isTeamAdmin, currentUserProfile]);
  
  const positionOptions = useMemo(() => positions.map(p => p.name), [positions]);
  
  const availability = useMemo(() => {
    const availabilityData: Record<string, Record<string, { available: User[], unavailable: UnavailableInfo[] }>> = {};
    const positionOrder = new Map(positions.map((p, i) => [p.name, i]));

    const sortUsers = (userList: (User | UnavailableInfo)[]) => {
      return userList.sort((a, b) => {
        const orderA = positionOrder.get(a.position) ?? 999;
        const orderB = positionOrder.get(b.position) ?? 999;
        if (orderA !== orderB) return orderA - orderB;
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

    weekdays.forEach(day => {
      timeSlots.forEach(time => {
        const slotAvailability = { available: [] as User[], unavailable: [] as UnavailableInfo[] };
        const dayIdx = slotCourses[day] || {};

        filteredUsers.forEach(user => {
          if (user.offDays.includes(day)) {
            slotAvailability.unavailable.push({ ...user, reason: "Off Day" });
            return;
          }

          const userMeetingsInSlot = meetings.filter(m => m.day === day && m.time === time && m.attendees.some(a => a.userId === user.id && a.status === 'accepted'));
          if (userMeetingsInSlot.length > 0) {
              slotAvailability.unavailable.push({ ...user, reason: `Meeting: ${userMeetingsInSlot[0].title}` });
              return;
          }

          const slotCoursesForTime = dayIdx[time] || [];
          const userCoursesInSlot = user.courses.filter(c => slotCoursesForTime.includes(c));
          
          let isBusy = false;
          let busyReason = "";

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
  }, [filteredUsers, timeSlots, slotCourses, positions, meetings]);
  
  const positionMap = useMemo(() => new Map(positions.map(p => [p.name, p.icon])), [positions]);
  
  const bestSlots = useMemo(() => {
    if (filteredUsers.length === 0) return { today: [], overall: [] };
    
    const allSlots: SlotInfo[] = [];
    const today = getCurrentDay();
    const todaySlots: SlotInfo[] = [];

    weekdays.forEach(day => {
      timeSlots.forEach(time => {
        const availableCount = availability[day]?.[time]?.available.length || 0;
        const slotInfo: SlotInfo = { day, time, availableCount, totalCount: filteredUsers.length };
        allSlots.push(slotInfo);
        if (day === today) todaySlots.push(slotInfo);
      });
    });

    const sortFn = (a: SlotInfo, b: SlotInfo) => b.availableCount - a.availableCount;
    
    return {
      today: todaySlots.sort(sortFn).slice(0, 2),
      overall: allSlots.sort(sortFn).slice(0, 3)
    };
  }, [availability, filteredUsers, timeSlots]);


  const isScheduleEmpty = timeSlots.length === 0;
  const pageLoading = loading || authLoading;
  const addFilterGroup = () => {
    setAdvancedFilterGroups(prev => [...prev, { id: nextGroupId, teams: [], subTeams: [], positions: [] }]);
    setNextGroupId(prev => prev + 1);
  };
  const removeFilterGroup = (id: number) => setAdvancedFilterGroups(prev => prev.filter(group => group.id !== id));
  const updateFilterGroup = (id: number, field: keyof Omit<AdvancedFilterGroup, 'id'>, value: string[]) => {
    setAdvancedFilterGroups(prev => prev.map(group => group.id === id ? { ...group, [field]: value } : group ));
  };
  const clearAdvancedFilters = () => setAdvancedFilterGroups([]);
  const isAdvancedFilterActive = advancedFilterGroups.length > 0;
  
  const userMeetingsBySlot = useMemo(() => {
    const map = new Map<string, Meeting[]>();
    if (!currentUserProfile) return map;

    meetings.forEach(meeting => {
      if (meeting.attendees.some(a => a.userId === currentUserProfile.id && a.status === 'accepted')) {
        const key = `${meeting.day}-${meeting.time}`;
        const existing = map.get(key) || [];
        map.set(key, [...existing, meeting]);
      }
    });
    return map;
  }, [meetings, currentUserProfile]);

  if (pageLoading) {
    return <div className="flex items-center justify-center min-h-screen"><p>Loading schedule...</p></div>;
  }
  if (!currentUser) return null;

  return (
    <TooltipProvider>
      <div className="container mx-auto p-4 md:p-8">
        <Card className="overflow-hidden shadow-lg">
          <CardHeader>
            <CardTitle className="text-3xl font-bold tracking-tight">Team Schedule</CardTitle>
            <CardDescription className="text-lg text-muted-foreground">
              View team availability and schedule meetings. Your schedule is always visible.
            </CardDescription>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-6">
                <MultiSelect options={availableTeams} selected={teamFilters} onChange={setTeamFilters} placeholder="Filter by team..." disabled={!hasAdminPrivileges || isAdvancedFilterActive} />
                <MultiSelect options={availableSubTeams} selected={subTeamFilters} onChange={setSubTeamFilters} placeholder="Filter by sub-team..." disabled={!hasAdminPrivileges || availableSubTeams.length === 0 || isAdvancedFilterActive} />
                <MultiSelect options={positionOptions} selected={positionFilters} onChange={setPositionFilters} placeholder="Filter by position..." disabled={isAdvancedFilterActive} />
                 <Dialog open={isAdvancedFilterOpen} onOpenChange={setIsAdvancedFilterOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" className="gap-2"><Filter className="h-4 w-4" />Advanced Filters {isAdvancedFilterActive && `(${advancedFilterGroups.length})`}</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl">
                        <DialogHeader><DialogTitle>Advanced Filters</DialogTitle><CardDescription>Show users who match ANY of the following groups. Within each group, users must match ALL criteria selected.</CardDescription></DialogHeader>
                        <ScrollArea className="max-h-[60vh] p-1">
                            <div className="space-y-4 p-4">
                                {advancedFilterGroups.map((group, index) => {
                                    const availableSubTeamsForGroup = Object.entries(subTeams).filter(([team]) => group.teams.length === 0 || group.teams.includes(team)).flatMap(([, subs]) => subs);
                                    return (
                                        <div key={group.id} className="p-4 border rounded-lg space-y-3 relative">
                                            <Label className="font-semibold text-muted-foreground">Filter Group {index + 1}</Label>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div className="space-y-1"><Label>Team(s)</Label><MultiSelect options={availableTeams} selected={group.teams} onChange={(value) => updateFilterGroup(group.id, 'teams', value)} placeholder="Any Team" disabled={!hasAdminPrivileges} /></div>
                                                <div className="space-y-1"><Label>Sub-team(s)</Label><MultiSelect options={availableSubTeamsForGroup} selected={group.subTeams} onChange={(value) => updateFilterGroup(group.id, 'subTeams', value)} placeholder="Any Sub-team" disabled={!hasAdminPrivileges || availableSubTeamsForGroup.length === 0} /></div>
                                                <div className="space-y-1"><Label>Position(s)</Label><MultiSelect options={positionOptions} selected={group.positions} onChange={(value) => updateFilterGroup(group.id, 'positions', value)} placeholder="Any Position"/></div>
                                            </div>
                                            <Button variant="ghost" size="icon" className="absolute top-2 right-2" onClick={() => removeFilterGroup(group.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                                        </div>
                                    );
                                })}
                                <Button variant="outline" className="w-full" onClick={addFilterGroup}><PlusCircle className="mr-2 h-4 w-4" /> Add Filter Group</Button>
                            </div>
                        </ScrollArea>
                        <DialogFooter className="sm:justify-between items-center gap-2">
                             <Button variant="destructive" onClick={clearAdvancedFilters} disabled={!isAdvancedFilterActive}>Clear All Advanced Filters</Button>
                            <Button onClick={() => setIsAdvancedFilterOpen(false)}>Close</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {isScheduleEmpty ? (
              <div className="text-center py-16 text-muted-foreground"><p className="text-lg">The schedule is not available yet.</p><p>Please ask an admin to upload the timetable.</p></div>
            ) : (
             <>
               <Collapsible className="mb-4 border rounded-lg">
                <CollapsibleTrigger className="w-full p-3 flex justify-between items-center bg-muted/50 hover:bg-muted/80 rounded-t-lg">
                  <div className="flex items-center gap-2"><Star className="w-5 h-5 text-yellow-500" /><h4 className="font-semibold">Best Slots</h4></div>
                  <ChevronDown className="w-5 h-5 transition-transform [&[data-state=open]]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="p-4 text-sm">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h5 className="font-bold mb-2">Top 2 Slots Today ({getCurrentDay()})</h5>
                       {bestSlots.today.length > 0 && bestSlots.today[0].availableCount > 0 ? (
                        <div className="space-y-2">{bestSlots.today.map((slot, index) => (<div key={`today-${index}`} className="flex items-center gap-2"><Badge variant="secondary">{slot.time}</Badge><span className="font-medium">{slot.availableCount} / {slot.totalCount} members available</span></div>))}</div>
                      ) : <p className="text-muted-foreground italic">Not enough availability data for today.</p>}
                    </div>
                     <div>
                      <h5 className="font-bold mb-2">Top 3 Slots Overall (This Week)</h5>
                       {bestSlots.overall.length > 0 && bestSlots.overall[0].availableCount > 0 ? (
                        <div className="space-y-2">{bestSlots.overall.map((slot, index) => (<div key={`overall-${index}`} className="flex items-center gap-2"><Badge variant="secondary">{slot.day}, {slot.time}</Badge><span className="font-medium">{slot.availableCount} / {slot.totalCount} members available</span></div>))}</div>
                       ) : <p className="text-muted-foreground italic">Not enough availability data.</p>}
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <Tabs defaultValue={getCurrentDay()}>
                <TabsList className="w-full justify-start overflow-x-auto">{weekdays.map(day => <TabsTrigger key={day} value={day}>{day}</TabsTrigger>)}</TabsList>
                {weekdays.map(day => (
                  <TabsContent key={day} value={day} className="relative z-10">
                    <ScrollArea className="h-[60vh] -mx-6 px-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 py-4">
                        {timeSlots.map(time => {
                          const userMeetings = userMeetingsBySlot.get(`${day}-${time}`) || [];
                          return (
                          <div key={time} className="border rounded-xl bg-card shadow-md transition-shadow hover:shadow-xl">
                            <div className="p-3 border-b bg-muted/50 rounded-t-xl">
                                <h4 className="font-semibold text-center text-sm">{time}</h4>
                            </div>
                            <div className="p-3 space-y-3">
                              {userMeetings.length > 0 && (
                                <div className="border-l-4 border-blue-500 pl-2 text-sm">
                                  <p className="font-bold text-blue-600">Your Meeting:</p>
                                  {userMeetings.map(m => <p key={m.id} className="text-muted-foreground">{m.title}</p>)}
                                </div>
                              )}
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
                                        <TooltipContent><p className="font-semibold">{user.position} {positionMap.get(user.position)}</p><p>{user.nuId}</p><p>{user.team} {user.subTeam && `> ${user.subTeam}`}</p></TooltipContent>
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
                                        <TooltipContent><p className="font-semibold">{user.position} {positionMap.get(user.position)}</p><p>{user.nuId}</p><p>{user.team} {user.subTeam && `> ${user.subTeam}`}</p><p className="text-red-500">{user.reason}</p></TooltipContent>
                                      </Tooltip>
                                    ))
                                    ) : <p className="text-xs text-muted-foreground italic text-center py-2">None</p>}
                                 </div>
                              </div>
                            </div>
                             {hasAdminPrivileges && <div className="p-3 border-t"><ScheduleMeetingDialog day={day} time={time} /></div>}
                          </div>
                        )})}
                      </div>
                    </ScrollArea>
                  </TabsContent>
                ))}
              </Tabs>
             </>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
