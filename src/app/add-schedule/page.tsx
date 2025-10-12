

"use client";


import { useState, useMemo, useEffect } from "react";
import { BookUser, Search, Eye, ChevronDown, AlertTriangle, Link, Check } from "lucide-react";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, } from "@/components/ui/alert-dialog";
import { getGoogleAuthUrlFlow } from "@/ai/flows/google-auth-flow";


const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const NO_SUB_TEAM_VALUE = "__none__";


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

  const [isWarningDialogOpen, setIsWarningDialogOpen] = useState(false);
  
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

  const availableVisibilitySubTeams = useMemo(() => {
    if (visibleToTeams.length === 0) {
        return visibilityOptions.subTeamOptions;
    }
    
    // Filter sub-teams based on selected visibility teams
    return Object.entries(subTeams)
        .filter(([teamName]) => visibleToTeams.includes(teamName))
        .flatMap(([, subTeamList]) => subTeamList)
        .filter(subTeam => visibilityOptions.subTeamOptions.includes(subTeam));

  }, [visibleToTeams, subTeams, visibilityOptions.subTeamOptions]);


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


  const proceedWithSave = async () => {
    if (!currentUser) {
      toast({ variant: "destructive", title: "Error", description: "You must be logged in to add a schedule." });
      return;
    }

    const courses = Object.entries(selectedCourses)
      .filter(([, isSelected]) => isSelected)
      .map(([course]) => course);

    const currentOffDays = Object.entries(offDays).filter(([, isOff]) => isOff).map(([day]) => day);
    
    const finalSubTeam = userSubTeam === NO_SUB_TEAM_VALUE ? "" : userSubTeam;

    const role = currentUserProfile?.role || 'none';
    const hasAdminRole = role !== 'none';
    const teamChanged = currentUserProfile?.team !== userTeam;
    const subTeamChanged = (currentUserProfile?.subTeam || '') !== finalSubTeam;

    let finalRole = role;
    let finalExecutiveTeams = currentUserProfile?.teams;
    let finalNotificationPreferences = currentUserProfile?.notificationPreferences || { onUserJoin: { teams: [], subTeams: [] } };

    if (hasAdminRole && (teamChanged || subTeamChanged)) {
      finalRole = 'none';
      finalExecutiveTeams = []; // Clear executive teams as well
      finalNotificationPreferences = { onUserJoin: { teams: [], subTeams: [] } };
    }

    const userData: User = {
      id: currentUser.uid,
      name: userName,
      nuId: userNUID,
      email: userEmail,
      courses: courses,
      team: userTeam,
      subTeam: finalSubTeam,
      position: userPosition,
      offDays: currentOffDays,
      scheduleVisibleTo: {
        teams: visibleToTeams,
        subTeams: visibleToSubTeams,
      },
      role: finalRole,
      notificationPreferences: finalNotificationPreferences,
      ...(finalRole === 'executive' && finalExecutiveTeams && { teams: finalExecutiveTeams }),
      createdAt: currentUserProfile?.createdAt || Date.now(),
      googleRefreshToken: currentUserProfile?.googleRefreshToken || null,
    };
    
    await addUser(userData, !isEditing); // addUser is actually a setDoc, so it works for create and update
    toast({ title: isEditing ? "Schedule Updated" : "Schedule Added", description: `Your schedule has been ${isEditing ? 'updated' : 'saved'}.` });
    if(hasAdminRole && (teamChanged || subTeamChanged)) {
      toast({ variant: "destructive", title: "Admin Access Revoked", description: "Your administrative role has been removed because you changed your team/sub-team." });
    }
    router.push("/view-schedule");
  };

  const handleSaveSchedule = () => {
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
    
    const finalSubTeam = userSubTeam === NO_SUB_TEAM_VALUE ? "" : userSubTeam;
    const hasAdminRole = currentUserProfile && currentUserProfile.role && currentUserProfile.role !== 'none';
    const teamChanged = hasAdminRole && currentUserProfile.team !== userTeam;
    const subTeamChanged = hasAdminRole && (currentUserProfile.subTeam || '') !== finalSubTeam;

    if (teamChanged || subTeamChanged) {
        setIsWarningDialogOpen(true);
    } else {
        proceedWithSave();
    }
  };


  const filteredCourses = useMemo(() => {
    if (!courseSearchTerm) return allCourses;
    const query = courseSearchTerm.toLowerCase();
    return allCourses.filter((c) => c.toLowerCase().includes(query));
  }, [allCourses, courseSearchTerm]);

  const isFormDisabled = timeSlots.length === 0 && !isEditing;
  
  const pageLoading = loading || authLoading;

  const handleQuickSelect = (type: 'all-teams' | 'all-subteams' | `subteams-of-${string}`, teamName?: string) => {
    if (type === 'all-teams') {
        setVisibleToTeams([...visibilityOptions.teamOptions]);
    } else if (type === 'all-subteams') {
        setVisibleToSubTeams([...availableVisibilitySubTeams]);
    } else if (type.startsWith('subteams-of-') && teamName) {
        const subteamsToSelect = subTeams[teamName] || [];
        const currentSelection = new Set(visibleToSubTeams);
        subteamsToSelect.forEach(st => currentSelection.add(st));
        setVisibleToSubTeams(Array.from(currentSelection));
    }
  };

  const handleConnectCalendar = async () => {
    if (!currentUser) return;
    try {
      const { authUrl } = await getGoogleAuthUrlFlow({ userId: currentUser.uid });
      window.location.href = authUrl;
    } catch (error) {
      console.error('Failed to get Google Auth URL', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not connect to Google Calendar. Please try again later.',
      });
    }
  };

  const isCalendarConnected = !!currentUserProfile?.googleRefreshToken;


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
    <>
      <AlertDialog open={isWarningDialogOpen} onOpenChange={setIsWarningDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="text-destructive" />
                Admin Role Warning
            </AlertDialogTitle>
            <AlertDialogDescription>
              You are about to change your team or sub-team. This action will revoke your administrative privileges. Are you sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={proceedWithSave}>
              Continue & Revoke Access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
                    <SelectItem value={NO_SUB_TEAM_VALUE}>No sub-team</SelectItem>
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
              <div className="flex justify-between items-center">
              <h3 className="font-semibold flex items-center gap-2"><Eye className="w-5 h-5"/> Schedule Visibility</h3>
                  {(isUniversalAdmin || isExecutiveAdmin) && (
                      <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm">
                                  Quick Select <ChevronDown className="ml-2 h-4 w-4" />
                              </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => handleQuickSelect('all-teams')}>
                                  Select all manageable teams
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => handleQuickSelect('all-subteams')}>
                                  Select all manageable sub-teams
                              </DropdownMenuItem>
                              {visibilityOptions.teamOptions.length > 0 && <DropdownMenuSeparator />}
                              {visibilityOptions.teamOptions.map(team => (
                                  <DropdownMenuItem key={team} onSelect={() => handleQuickSelect(`subteams-of-${team}`, team)}>
                                      Select all sub-teams of {team}
                                  </DropdownMenuItem>
                              ))}
                          </DropdownMenuContent>
                      </DropdownMenu>
                  )}
              </div>
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
                          options={availableVisibilitySubTeams}
                          selected={visibleToSubTeams}
                          onChange={setVisibleToSubTeams}
                          placeholder="Select sub-teams..."
                          disabled={availableVisibilitySubTeams.length === 0}
                      />
                  </div>
              </div>
            </div>

            <div className="space-y-4 rounded-lg border p-4">
                <h3 className="font-semibold flex items-center gap-2">
                    <Link className="w-5 h-5" /> Integrations
                </h3>
                <p className="text-sm text-muted-foreground">
                    Connect your account to other services.
                </p>
                {isCalendarConnected ? (
                    <Button variant="outline" disabled className="border-green-500 text-green-600">
                        <Check className="w-4 h-4 mr-2" />
                        Connected to Google Calendar
                    </Button>
                ) : (
                    <Button onClick={handleConnectCalendar} variant="outline">
                        <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M21 5.25H3a.75.75 0 00-.75.75v12A2.25 2.25 0 004.5 20.25h15A2.25 2.25 0 0021.75 18V6a.75.75 0 00-.75-.75zM19.5 7.5v1.5H9v-3h9a1.5 1.5 0 011.5 1.5zM4.5 6h3v3H3V6.75A.75.75 0 014.5 6zm0 4.5h15v7.5H4.5z"></path>
                            <path d="M12 12.75a1.5 1.5 0 100 3 1.5 1.5 0 000-3z"></path>
                        </svg>
                        Connect Google Calendar
                    </Button>
                )}
            </div>

            <Button onClick={handleSaveSchedule} className="w-full">
              {isEditing ? "Update Schedule" : "Submit Schedule"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
