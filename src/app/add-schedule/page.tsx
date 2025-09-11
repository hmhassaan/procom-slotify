
"use client";

import { useState, useMemo, useEffect } from "react";
import { BookUser, Search } from "lucide-react";
import { useRouter } from "next/navigation";

import { useToast } from "@/hooks/use-toast";
import { useAppContext } from "@/context/AppContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { User } from "@/app/types";
import { useAuth } from "@/context/AuthContext";

const teams = ["ExCom/Core", "CS Competitions", "AI Competitions", "Web Development", "Automation"];
const positions = ["Executive", "Mentor", "Head", "Co-head", "Deputy Head", "Module Head", "Module Cohead", "Member"];
const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export default function AddSchedulePage() {
  const { allCourses, timeSlots, addUser, loading } = useAppContext();
  const router = useRouter();
  const { toast } = useToast();
  const { currentUser } = useAuth();

  const [newUserName, setNewUserName] = useState("");
  const [newUserTeam, setNewUserTeam] = useState("");
  const [newUserPosition, setNewUserPosition] = useState("");
  const [offDays, setOffDays] = useState<Record<string, boolean>>({});
  const [courseSearchTerm, setCourseSearchTerm] = useState("");
  const [selectedCourses, setSelectedCourses] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!currentUser) {
      router.push("/");
    } else {
      setNewUserName(currentUser.displayName || "");
    }
  }, [currentUser, router]);

  const handleAddUser = async () => {
    if (!newUserName.trim()) {
      toast({ variant: "destructive", title: "Error", description: "Please enter a user name." });
      return;
    }
    const userCourses = Object.entries(selectedCourses)
      .filter(([, isSelected]) => isSelected)
      .map(([course]) => course);
    if (userCourses.length === 0) {
      toast({ variant: "destructive", title: "Error", description: "Please select at least one course." });
      return;
    }
    if (!newUserTeam) {
      toast({ variant: "destructive", title: "Error", description: "Please select a team." });
      return;
    }
    if (!newUserPosition) {
      toast({ variant: "destructive", title: "Error", description: "Please select a position." });
      return;
    }

    const userOffDays = Object.entries(offDays).filter(([, isOff]) => isOff).map(([day]) => day);
    
    if (!currentUser) {
      toast({ variant: "destructive", title: "Error", description: "You must be logged in to add a schedule." });
      return;
    }

    const newUser: User = {
      id: currentUser.uid,
      name: newUserName,
      courses: userCourses,
      team: newUserTeam,
      position: newUserPosition,
      offDays: userOffDays,
    };
    await addUser(newUser);
    toast({ title: "User Added", description: `${newUser.name} has been added.` });
    router.push("/view-schedule");
  };

  const filteredCourses = useMemo(() => {
    if (!courseSearchTerm) return allCourses;
    const query = courseSearchTerm.toLowerCase();
    return allCourses.filter((c) => c.toLowerCase().includes(query));
  }, [allCourses, courseSearchTerm]);

  const isFormDisabled = timeSlots.length === 0;
  
  if (loading) {
    return (
        <div className="flex items-center justify-center min-h-screen">
          <p>Loading schedule...</p>
        </div>
      );
  }

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Redirecting to login...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Card className={`max-w-2xl mx-auto ${isFormDisabled ? "opacity-50 pointer-events-none" : ""}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookUser className="w-6 h-6" />
            Add Your Schedule
          </CardTitle>
          <CardDescription>
            {isFormDisabled
              ? "The admin has not uploaded a timetable yet. Please check back later."
              : "Create your profile and select your courses."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="user-name" className="font-semibold">Your Name</Label>
            <Input id="user-name" placeholder="e.g., Alex Doe" value={newUserName} onChange={(e) => setNewUserName(e.target.value)} className="mt-2" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="user-team" className="font-semibold">Team</Label>
              <Select value={newUserTeam} onValueChange={setNewUserTeam}>
                <SelectTrigger id="user-team" className="mt-2">
                  <SelectValue placeholder="Select team" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((team) => (
                    <SelectItem key={team} value={team}>{team}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="user-position" className="font-semibold">Position</Label>
              <Select value={newUserPosition} onValueChange={setNewUserPosition}>
                <SelectTrigger id="user-position" className="mt-2">
                  <SelectValue placeholder="Select position" />
                </SelectTrigger>
                <SelectContent>
                  {positions.map((pos) => (
                    <SelectItem key={pos} value={pos}>{pos}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="font-semibold">Off Days</Label>
            <div className="flex flex-wrap gap-x-4 gap-y-2 mt-2">
              {weekdays.map((day) => (
                <div key={day} className="flex items-center space-x-2">
                  <Checkbox
                    id={`off-${day}`}
                    checked={offDays[day] || false}
                    onCheckedChange={(checked) => setOffDays((prev) => ({ ...prev, [day]: !!checked }))}
                  />
                  <Label htmlFor={`off-${day}`} className="font-normal">{day}</Label>
                </div>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="course-search" className="font-semibold">Select Courses</Label>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="course-search"
                placeholder="Search for a course..."
                value={courseSearchTerm}
                onChange={(e) => setCourseSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <ScrollArea className="h-40 rounded-md border p-4 mt-2">
              <div className="space-y-2">
                {filteredCourses.length > 0 ? (
                  filteredCourses.map((course) => (
                    <div key={course} className="flex items-center space-x-2">
                      <Checkbox
                        id={course}
                        checked={selectedCourses[course] || false}
                        onCheckedChange={(checked) => setSelectedCourses((prev) => ({ ...prev, [course]: !!checked }))}
                      />
                      <Label htmlFor={course} className="font-normal">{course}</Label>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-center text-muted-foreground">No courses found.</p>
                )}
              </div>
            </ScrollArea>
          </div>
          <Button onClick={handleAddUser} className="w-full">Submit Schedule</Button>
        </CardContent>
      </Card>
    </div>
  );
}
