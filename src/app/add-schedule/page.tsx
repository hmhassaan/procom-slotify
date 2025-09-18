
"use client";

import { useState, useMemo, useEffect } from "react";
import { BookUser, Search, Eye } from "lucide-react";
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
import { MultiSelect } from "@/components/ui/multi-select";

const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export default function AddSchedulePage() {
  const { allCourses, timeSlots, addUser, loading, teams, positions, subTeams, currentUserProfile, isUniversalAdmin, isExecutiveAdmin, isTeamAdmin, isSubTeamAdmin } = useAppContext();
  const router = useRouter();
  const { toast } = useToast();
  const { currentUser, loading: authLoading } = useAuth();
  
  const [isEditing, setIsEditing] = useState(false);
  const [userName, setUserName] = useState("");
  const [userNUID, setUserNUID] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userTeam, setUserTeam] = useState("");
  const [userSubTeam, setUserSubTeam] = useState("");
  const [userPosition, setUserPosition] = useState("");
  const [offDays, setOffDays] = useState<Record<string, boolean>>({});
  const [courseSearchTerm, setCourseSearchTerm] = useState("");
  const [selectedCourses, setSelectedCourses] = useState<Record<string, boolean>>({});
  const [visibleToTeams, setVisibleToTeams] = useState<string[]>([]);
  const [visibleToSubTeams, setVisibleToSubTeams] = useState<string[]>([]);
  
  const availableSubTeams = useMemo(() => {
    return userTeam ? subTeams[userTeam] || [] : [];
  }, [userTeam, subTeams]);

  // Determine which teams/sub-teams can be selected for visibility
  const visibilityOptions = useMemo(() => {
    if (!currentUserProfile) return { teamOptions: [], subTeamOptions: [] };

    if (isUniversalAdmin) {
      const allSubTeams = Object.values(subTeams).flat();
      return { teamOptions: teams, subTeamOptions: allSubTeams };
    }
    if (isExecutiveAdmin) {
      const manageableTeams = currentUserProfile.teams || [];
      const manageableSubTeams = Object.entries(subTeams)
        .filter(([team]) => manageableTeams.includes(team))
        .flatMap(([, subs]) => subs);
      return { teamOptions: manageableTeams, subTeamOptions: manageableSubTeams };
    }
    // For Team Admin, Sub-team Admin, and regular users
    const ownSubTeams = subTeams[currentUserProfile.team] || [];
    return { teamOptions: [], subTeamOptions: ownSubTeams };

  }, [currentUserProfile, teams, subTeams, isUniversalAdmin, isExecutiveAdmin]);


  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push("/login");
    } 
  }, [currentUser, authLoading, router]);

  useEffect(() => {
    if (currentUserProfile) {
        setIsEditing(true);
        setUserName(currentUserProfile.name);
        setUserNUID(currentUserProfile.nuId);
        setUserEmail(currentUserProfile.email);
        setUserTeam(currentUserProfile.team || "");
        setUserSubTeam(currentUserProfile.subTeam || "");
        setUserPosition(currentUserProfile.position);
        
        const userOffDays = currentUserProfile.offDays.reduce((acc, day) => {
            acc[day] = true;
            return acc;
        }, {} as Record<string, boolean>);
        setOffDays(userOffDays);

        const userCourses = currentUserProfile.courses.reduce((acc, course) => {
            acc[course] = true;
            return acc;
        }, {} as Record<string, boolean>);
        setSelectedCourses(userCourses);
        
        setVisibleToTeams(currentUserProfile.scheduleVisibleTo?.teams || []);
        setVisibleToSubTeams(currentUserProfile.scheduleVisibleTo?.subTeams || []);

    } else if (currentUser) {
        // New user, prefill from auth
        setIsEditing(false);
        setUserName(currentUser.displayName || "");
        setUserEmail(currentUser.email || "");
    }
  }, [currentUserProfile, currentUser]);


  useEffect(() => {
    // Reset subteam if team changes and the current subteam is not valid for the new team
    if (userTeam && !availableSubTeams.includes(userSubTeam)) {
        setUserSubTeam("");
    }
  }, [userTeam, userSubTeam, availableSubTeams]);


  const handleSaveSchedule = async () => {
    if (!userName.trim()) {
      toast({ variant: "destructive", title: "Error", description: "Please enter a user name." });
      return;
    }
    if (!userNUID.trim()) {
      toast({ variant: "destructive", title: "Error", description: "Please enter your NU-ID." });
      return;
    }
    const courses = Object.entries(selectedCourses)
      .filter(([, isSelected]) => isSelected)
      .map(([course]) => course);
    if (courses.length === 0) {
      toast({ variant: "destructive", title: "Error", description: "Please select at least one course." });
      return;
    }
    if (!userTeam) {
      toast({ variant: "destructive", title: "Error", description: "Please select a team." });
      return;
    }
    if (!userPosition) {
      toast({ variant: "destructive", title: "Error", description: "Please select a position." });
      return;
    }

    const currentOffDays = Object.entries(offDays).filter(([, isOff]) => isOff).map(([day]) => day);
    
    if (!currentUser) {
      toast({ variant: "destructive", title: "Error", description: "You must be logged in to add a schedule." });
      return;
    }

    const userData: User = {
      id: currentUser.uid,
      name: userName,
      nuId: userNUID,
      email: userEmail,
      courses: courses,
      team: userTeam,
      subTeam: userSubTeam || "",
      position: userPosition,
      offDays: currentOffDays,
      scheduleVisibleTo: {
        teams: visibleToTeams,
        subTeams: visibleToSubTeams,
      },
      // Preserve existing role, or set to 'none' for new users
      role: currentUserProfile?.role || 'none',
      // Preserve executive teams if they exist
      ...(currentUserProfile?.role === 'executive' && { teams: currentUserProfile.teams }),
      createdAt: currentUserProfile?.createdAt || Date.now(),
    };
    await addUser(userData); // addUser is actually a setDoc, so it works for create and update
    toast({ title: isEditing ? "Schedule Updated" : "Schedule Added", description: `Your schedule has been ${isEditing ? 'updated' : 'saved'}.` });
    router.push("/view-schedule");
  };

  const filteredCourses = useMemo(() => {
    if (!courseSearchTerm) return allCourses;
    const query = courseSearchTerm.toLowerCase();
    return allCourses.filter((c) => c.toLowerCase().includes(query));
  }, [allCourses, courseSearchTerm]);

  const isFormDisabled = timeSlots.length === 0 && !isEditing;
  
  const pageLoading = loading || authLoading;

  if (pageLoading) {
    return (
        <div className="flex items-center justify-center min-h-screen">
          <p>Loading...</p>
        </div>
      );
  }

  if (!currentUser) {
    return null;
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Card className={`max-w-2xl mx-auto ${isFormDisabled ? "opacity-50 pointer-events-none" : ""}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookUser className="w-6 h-6" />
            {isEditing ? "Edit Your Schedule" : "Add Your Schedule"}
          </CardTitle>
          <CardDescription>
            {isFormDisabled
              ? "The admin has not uploaded a timetable yet. Please check back later."
              : isEditing 
                ? "Update your profile, courses, and availability."
                : "Create your profile and select your courses to get started."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="user-name" className="font-semibold">Your Name</Label>
              <Input id="user-name" placeholder="e.g., Alex Doe" value={userName} onChange={(e) => setUserName(e.target.value)} className="mt-2" />
            </div>
            <div>
              <Label htmlFor="user-email" className="font-semibold">Email</Label>
              <Input id="user-email" value={userEmail} disabled className="mt-2" />
            </div>
          </div>
          <div>
            <Label htmlFor="user-nuid" className="font-semibold">NU-ID</Label>
            <Input id="user-nuid" placeholder="e.g., 20K-1234" value={userNUID} onChange={(e) => setUserNUID(e.target.value)} className="mt-2" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="user-team" className="font-semibold">Team</Label>
              <Select value={userTeam} onValueChange={setUserTeam}>
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
              <Label htmlFor="user-subteam" className="font-semibold">Sub-team (Optional)</Label>
              <Select value={userSubTeam} onValueChange={setUserSubTeam} disabled={availableSubTeams.length === 0}>
                <SelectTrigger id="user-subteam" className="mt-2">
                  <SelectValue placeholder="Select sub-team" />
                </SelectTrigger>
                <SelectContent>
                  {availableSubTeams.map((subTeam) => (
                    <SelectItem key={subTeam} value={subTeam}>{subTeam}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
           <div>
              <Label htmlFor="user-position" className="font-semibold">Position</Label>
              <Select value={userPosition} onValueChange={setUserPosition}>
                <SelectTrigger id="user-position" className="mt-2">
                  <SelectValue placeholder="Select position" />
                </SelectTrigger>
                <SelectContent>
                  {positions.map((pos) => (
                    <SelectItem key={pos.id} value={pos.name}>{pos.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

          <div className="space-y-4 rounded-lg border p-4">
             <h3 className="font-semibold flex items-center gap-2"><Eye className="w-5 h-5"/> Schedule Visibility</h3>
             <p className="text-sm text-muted-foreground">
                Control which teams or sub-teams can view your schedule.
             </p>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <Label>Allow Teams to View</Label>
                     <MultiSelect
                        options={visibilityOptions.teamOptions}
                        selected={visibleToTeams}
                        onChange={setVisibleToTeams}
                        placeholder="Select teams..."
                        disabled={visibilityOptions.teamOptions.length === 0}
                    />
                 </div>
                 <div className="space-y-2">
                    <Label>Allow Sub-teams to View</Label>
                     <MultiSelect
                        options={visibilityOptions.subTeamOptions}
                        selected={visibleToSubTeams}
                        onChange={setVisibleToSubTeams}
                        placeholder="Select sub-teams..."
                        disabled={visibilityOptions.subTeamOptions.length === 0}
                    />
                 </div>
             </div>
          </div>

          <Button onClick={handleSaveSchedule} className="w-full">
            {isEditing ? "Update Schedule" : "Submit Schedule"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
