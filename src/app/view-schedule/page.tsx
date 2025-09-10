
"use client";

import { useState, useMemo, useEffect } from "react";
import { useAppContext } from "@/context/AppContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { User } from "@/app/types";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const teams = ["All", "ExCom/Core", "CS Competitions", "AI Competitions", "Web Development", "Automation"];
const positions = ["All", "Executive", "Mentor", "Head", "Co-head", "Deputy Head", "Module Head", "Module Cohead", "Member"];

const isLab = (name: string) => /\blab\b/i.test(name);

export default function ViewSchedulePage() {
  const { users, timeSlots, slotCourses } = useAppContext();
  const [teamFilter, setTeamFilter] = useState("All");
  const [positionFilter, setPositionFilter] = useState("All");
  const { currentUser } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!currentUser) {
      router.push("/");
    }
  }, [currentUser, router]);

  const filteredUsers = useMemo(() => {
    return users.filter(user =>
      (teamFilter === "All" || user.team === teamFilter) &&
      (positionFilter === "All" || user.position === positionFilter)
    );
  }, [users, teamFilter, positionFilter]);

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

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Redirecting to login...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Card>
        <CardHeader>
          <CardTitle>Team Schedule</CardTitle>
          <div className="flex flex-col sm:flex-row gap-4 mt-4">
            <Select value={teamFilter} onValueChange={setTeamFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filter by team" />
              </SelectTrigger>
              <SelectContent>
                {teams.map(team => <SelectItem key={team} value={team}>{team}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={positionFilter} onValueChange={setPositionFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filter by position" />
              </SelectTrigger>
              <SelectContent>
                {positions.map(pos => <SelectItem key={pos} value={pos}>{pos}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
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
              <TabsContent key={day} value={day}>
                <ScrollArea className="h-[60vh]">
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
