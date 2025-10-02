
"use client";

import { useState, useEffect, useMemo } from "react";
import { useAppContext } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, X, Calendar as CalendarIcon, User, Users, Trash2, CalendarPlus, Clock, MapPin, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Meeting, MeetingAttendeeStatus, User as AppUser, Position } from "@/app/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { format, isPast, addMinutes } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const ScheduleMeetingFromMeetingsPage = () => {
    const { users, currentUserProfile, createMeeting, canViewUser, teams, subTeams, positions } = useAppContext();
    const { toast } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [meetingTitle, setMeetingTitle] = useState("");
    const [selectedDate, setSelectedDate] = useState<Date | undefined>();
    const [timeInput, setTimeInput] = useState("09:00");
    const [timeAmPm, setTimeAmPm] = useState("AM");
    const [duration, setDuration] = useState(50);
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [location, setLocation] = useState("");
    const [externalAttendees, setExternalAttendees] = useState("");
    const [generateMeetLink, setGenerateMeetLink] = useState(false);
  
    useEffect(() => {
        if (isOpen) {
            setMeetingTitle("");
            setSelectedUserIds([]);
            setSelectedDate(new Date());
            setTimeInput("09:00");
            setTimeAmPm("AM");
            setDuration(50);
            setLocation("");
            setExternalAttendees("");
            setGenerateMeetLink(false);
            setIsCreating(false);
        }
    }, [isOpen]);
  
    const handleCreateMeeting = async () => {
        if (isCreating) return;
        if (!meetingTitle.trim()) { toast({ variant: "destructive", title: "Title is required" }); return; }
        if (!selectedDate) { toast({ variant: "destructive", title: "Date is required" }); return; }
        if (!timeInput.trim()) { toast({ variant: "destructive", title: "Time is required" }); return; }
        if (selectedUserIds.length === 0 && !externalAttendees.trim()) { toast({ variant: "destructive", title: "Select at least one member or add an external attendee" }); return; }
        if (!currentUserProfile) return;
  
        setIsCreating(true);
        try {
            const finalTime = `${timeInput} ${timeAmPm}`;
            const externalEmails = externalAttendees.split(/[\n,;]+/).map(e => e.trim()).filter(Boolean);
            await createMeeting({ 
                title: meetingTitle, 
                date: selectedDate.getTime(), 
                time: finalTime, 
                durationInMinutes: duration, 
                attendeeIds: selectedUserIds,
                location: location.trim(),
                externalAttendees: externalEmails,
                generateMeetLink: generateMeetLink,
            });
            toast({ title: "Meeting Scheduled", description: "Invitations have been sent." });
            setIsOpen(false);
        } catch (e) {
            console.error(e);
            toast({ variant: "destructive", title: "Error", description: "Could not schedule meeting." });
        } finally {
            setIsCreating(false);
        }
    };
  
     const inviteeListStructure = useMemo(() => {
        const allVisibleUsers = users.filter(u => canViewUser(u) && u.id !== currentUserProfile?.id);
        const positionOrder = new Map(positions.map((p, i) => [p.name, i]));
        const sortUsers = (userList: AppUser[]) => {
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

    const toggleSelection = (ids: string[], select: boolean) => {
        setSelectedUserIds(prev => {
            const idSet = new Set(prev);
            ids.forEach(id => {
                if (select) idSet.add(id);
                else idSet.delete(id);
            });
            return Array.from(idSet);
        });
    };
    
    const handleGroupSelection = (ids: string[]) => {
      const allSelected = ids.every(id => selectedUserIds.includes(id));
      toggleSelection(ids, !allSelected);
    };

    const allInviteeIds = useMemo(() => inviteeListStructure.flatMap(t => [...t.usersInNoSubTeam.map(u => u.id), ...t.subTeams.flatMap(st => st.users.map(u => u.id))]), [inviteeListStructure]);

    if (!currentUserProfile) return null;
  
    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button><CalendarPlus className="mr-2"/>Schedule Meeting</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Schedule a New Meeting</DialogTitle>
                    <DialogDescription>Choose a title, slot, and invite members.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <Input id="meeting-title" value={meetingTitle} onChange={(e) => setMeetingTitle(e.target.value)} placeholder="Meeting Title" />
                    <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location (e.g., Cafe, Library) - Optional" />
                    <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant={"outline"} className={cn("justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}>
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} initialFocus />
                            </PopoverContent>
                        </Popover>
                        <Input type="text" value={timeInput} onChange={(e) => setTimeInput(e.target.value)} className="w-[100px]"/>
                        <Select value={timeAmPm} onValueChange={setTimeAmPm}>
                            <SelectTrigger className="w-[70px]"><SelectValue/></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="AM">AM</SelectItem>
                                <SelectItem value="PM">PM</SelectItem>
                            </SelectContent>
                        </Select>
                        <div className="flex items-center gap-1.5">
                            <Input id="duration" type="number" value={duration} onChange={(e) => setDuration(parseInt(e.target.value, 10) || 0)} className="w-[60px] text-center" />
                            <Label htmlFor="duration" className="text-sm text-muted-foreground">min</Label>
                        </div>
                    </div>
                     <div className="flex items-center space-x-2">
                        <Checkbox id="generate-meet-link" checked={generateMeetLink} onCheckedChange={(checked) => setGenerateMeetLink(!!checked)} />
                        <Label htmlFor="generate-meet-link">Generate Google Meet Link</Label>
                    </div>
                    <div>
                         <Label htmlFor="external-attendees">External Attendees (Optional)</Label>
                         <Textarea id="external-attendees" value={externalAttendees} onChange={(e) => setExternalAttendees(e.target.value)} placeholder="Enter comma-separated emails..."/>
                    </div>
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <Label>Invite Members</Label>
                            <div className="flex gap-2">
                                <Button variant="link" size="sm" onClick={() => toggleSelection(allInviteeIds, true)}>Select All</Button>
                                <Button variant="link" size="sm" onClick={() => toggleSelection(allInviteeIds, false)}>Deselect All</Button>
                            </div>
                        </div>
                        <ScrollArea className="h-60 border rounded-md p-4">
                            <div className="space-y-4">
                                {inviteeListStructure.map(team => {
                                    const teamUserIds = team.usersInNoSubTeam.map(u => u.id);
                                    const areAllTeamUsersSelected = team.usersInNoSubTeam.length > 0 && teamUserIds.every(id => selectedUserIds.includes(id));
                                    return (
                                        <div key={team.name}>
                                            <div className="flex items-center gap-2 font-semibold text-sm border-b mb-2 pb-1">
                                                <Checkbox id={`select-team-${team.name}`} 
                                                    checked={areAllTeamUsersSelected} 
                                                    onCheckedChange={() => handleGroupSelection(teamUserIds)}
                                                    disabled={team.usersInNoSubTeam.length === 0}
                                                />
                                                <Label htmlFor={`select-team-${team.name}`}>{team.name}</Label>
                                            </div>
                                            <div className="space-y-2">
                                                {team.usersInNoSubTeam.map(user => (
                                                    <div key={user.id} className="flex items-center gap-2 ml-4">
                                                    <Checkbox id={`invite-mtg-page-${user.id}`} checked={selectedUserIds.includes(user.id)} onCheckedChange={(checked) => toggleSelection([user.id], !!checked)} />
                                                    <Label htmlFor={`invite-mtg-page-${user.id}`}>{user.name} - {user.position}</Label>
                                                    </div>
                                                ))}
                                                {team.subTeams.map(subTeam => {
                                                    const subTeamUserIds = subTeam.users.map(u => u.id);
                                                    const areAllSubTeamUsersSelected = subTeam.users.length > 0 && subTeamUserIds.every(id => selectedUserIds.includes(id));
                                                    return (
                                                        <div key={subTeam.name} className="pl-4 pt-2">
                                                            <div className="flex items-center gap-2 font-medium text-xs text-muted-foreground mb-1">
                                                                <Checkbox id={`select-subteam-mtg-page-${subTeam.name}`} 
                                                                    checked={areAllSubTeamUsersSelected} 
                                                                    onCheckedChange={() => handleGroupSelection(subTeamUserIds)}
                                                                    disabled={subTeam.users.length === 0}
                                                                />
                                                                <Label htmlFor={`select-subteam-mtg-page-${subTeam.name}`}>{subTeam.name}</Label>
                                                            </div>
                                                            <div className="space-y-2">
                                                                {subTeam.users.map(user => (
                                                                    <div key={user.id} className="flex items-center gap-2 ml-4">
                                                                        <Checkbox id={`invite-mtg-page-${user.id}`} checked={selectedUserIds.includes(user.id)} onCheckedChange={(checked) => toggleSelection([user.id], !!checked)} />
                                                                        <Label htmlFor={`invite-mtg-page-${user.id}`}>{user.name} - {user.position}</Label>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </ScrollArea>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isCreating}>Cancel</Button>
                    <Button onClick={handleCreateMeeting} disabled={isCreating}>{isCreating ? "Creating..." : "Create Meeting & Notify"}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


const MeetingCard = ({ meeting, onRespond, onDelete }: { meeting: Meeting, onRespond: (meetingId: string, status: MeetingAttendeeStatus, reason?: string) => void, onDelete: (meetingId: string) => void }) => {
  const { currentUserProfile } = useAppContext();
  const [isDeclineDialogOpen, setIsDeclineDialogOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  
  if (!meeting.date || !currentUserProfile) {
    return null; // Don't render if meeting date is invalid or no user
  }

  const isOrganizer = meeting.organizerId === currentUserProfile.id;
  const currentUserAttendee = meeting.attendees.find(a => a.userId === currentUserProfile.id);
  const currentUserStatus = isOrganizer ? 'organizer' : currentUserAttendee?.status;
  
  const handleDeclineSubmit = () => {
    onRespond(meeting.id, 'declined', declineReason);
    setIsDeclineDialogOpen(false);
    setDeclineReason("");
  };

  const getStatusBadge = (status: MeetingAttendeeStatus) => {
    switch (status) {
      case 'accepted': return <Badge variant="secondary" className="bg-green-100 text-green-800">Accepted</Badge>;
      case 'declined': return <Badge variant="destructive">Declined</Badge>;
      case 'pending': return <Badge variant="outline">Pending</Badge>;
    }
  };
  
  const { meetingEndTime, meetingIsPast } = useMemo(() => {
    if (!meeting.date || !meeting.time) return { meetingEndTime: new Date(), meetingIsPast: true };

    const meetingDate = new Date(meeting.date);

    const [timePart, modifier] = meeting.time.split(' ');
    let [hours, minutes] = timePart.split(':').map(Number);
    if (modifier && modifier.toUpperCase() === 'PM' && hours < 12) hours += 12;
    if (modifier && modifier.toUpperCase() === 'AM' && hours === 12) hours = 0;

    const startDate = new Date(meetingDate.getFullYear(), meetingDate.getMonth(), meetingDate.getDate(), hours, minutes);
    const endDate = addMinutes(startDate, meeting.durationInMinutes || 50);
    
    return { meetingEndTime: endDate, meetingIsPast: isPast(endDate) };
  }, [meeting.date, meeting.time, meeting.durationInMinutes]);


  return (
    <Card className={cn(meetingIsPast && "opacity-60")}>
      <CardHeader>
        <CardTitle>{meeting.title}</CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 text-sm">
          <span className="flex items-center gap-2"><CalendarIcon className="w-4 h-4"/>{format(new Date(meeting.date), "EEE, MMM d")} at {meeting.time} {meetingIsPast && <Badge variant="outline">Past</Badge>}</span>
          <span className="flex items-center gap-2"><Clock className="w-4 h-4"/>{meeting.durationInMinutes || 50} min</span>
          <span className="flex items-center gap-2"><User className="w-4 h-4"/>Organized by {meeting.organizerName}</span>
          {meeting.location && <span className="flex items-center gap-2"><MapPin className="w-4 h-4"/>{meeting.location}</span>}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2"><Users className="w-4 h-4" />Attendees ({meeting.attendees.length + (meeting.externalAttendees?.length || 0)})</h4>
                <div className="flex flex-wrap gap-2">
                  {meeting.attendees.map(attendee => (
                     <TooltipProvider key={attendee.userId}>
                        <Tooltip>
                            <TooltipTrigger>
                               <div className="flex items-center gap-2 p-1.5 rounded-lg border">
                                    <Avatar className="h-6 w-6 text-xs">
                                    <AvatarFallback>{attendee.name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <span className="text-sm">{attendee.name}</span>
                                    {isOrganizer && getStatusBadge(attendee.status)}
                               </div>
                            </TooltipTrigger>
                             <TooltipContent>
                               {isOrganizer && attendee.status === 'declined' && attendee.responseReason ? <p>Reason: {attendee.responseReason}</p> : isOrganizer ? <p>Status: {attendee.status}</p> : <p>{attendee.name}</p>}
                            </TooltipContent>
                        </Tooltip>
                     </TooltipProvider>
                  ))}
                  {meeting.externalAttendees?.map(email => (
                     <TooltipProvider key={email}>
                        <Tooltip>
                            <TooltipTrigger>
                               <div className="flex items-center gap-2 p-1.5 rounded-lg border">
                                    <Avatar className="h-6 w-6 text-xs">
                                    <AvatarFallback>{email.charAt(0).toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                    <span className="text-sm italic">{email}</span>
                               </div>
                            </TooltipTrigger>
                             <TooltipContent>
                               <p>External Attendee</p>
                            </TooltipContent>
                        </Tooltip>
                     </TooltipProvider>
                  ))}
                </div>
              </div>
              {!isOrganizer && currentUserStatus && currentUserStatus !== 'organizer' && !meetingIsPast && (
                <div className="flex gap-2">
                  <Button size="sm" variant={currentUserStatus === 'accepted' ? "default" : "outline"} onClick={() => onRespond(meeting.id, 'accepted')}><Check className="mr-2"/>Accept</Button>
                  <Dialog open={isDeclineDialogOpen} onOpenChange={setIsDeclineDialogOpen}>
                     <DialogTrigger asChild>
                        <Button size="sm" variant={currentUserStatus === 'declined' ? "destructive" : "outline"}><X className="mr-2"/>Decline</Button>
                     </DialogTrigger>
                     <DialogContent>
                        <DialogHeader><DialogTitle>Decline Meeting</DialogTitle></DialogHeader>
                        <div className="py-4 space-y-2">
                            <Label htmlFor="decline-reason">Reason (Optional)</Label>
                            <Textarea id="decline-reason" value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} placeholder="Let the organizer know why you can't make it..."/>
                        </div>
                        <DialogFooter>
                            <Button variant="ghost" onClick={() => setIsDeclineDialogOpen(false)}>Cancel</Button>
                            <Button variant="destructive" onClick={handleDeclineSubmit}>Confirm Decline</Button>
                        </DialogFooter>
                     </DialogContent>
                  </Dialog>
                </div>
              )}
              {isOrganizer && !meetingIsPast && (
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button size="sm" variant="destructive" className="gap-2"><Trash2/>Cancel Meeting</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>This will cancel the meeting and notify all attendees. This action cannot be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Go Back</AlertDialogCancel>
                            <AlertDialogAction onClick={() => onDelete(meeting.id)}>Yes, Cancel Meeting</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
             {meeting.meetLink && !meetingIsPast && (
                <div className="pt-2">
                    <Button asChild>
                        <a href={meeting.meetLink} target="_blank" rel="noopener noreferrer">
                            <Video className="mr-2"/> Join with Google Meet
                        </a>
                    </Button>
                </div>
            )}
        </div>
      </CardContent>
    </Card>
  );
};

const MeetingList = ({ meetings, onRespond, onDelete }: { meetings: Meeting[], onRespond: (meetingId: string, status: MeetingAttendeeStatus, reason?: string) => void, onDelete: (meetingId: string) => void }) => {
    return (
        <div className="space-y-4">
            {meetings.map(m => <MeetingCard key={m.id} meeting={m} onRespond={onRespond} onDelete={onDelete} />)}
        </div>
    )
}


export default function MeetingsPage() {
  const { meetings, currentUserProfile, loading, respondToMeeting, deleteMeeting, hasAdminPrivileges } = useAppContext();
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push("/login");
    }
  }, [currentUser, authLoading, router]);

  const {
      upcomingAll, pastAll,
      upcomingInvited, pastInvited,
      upcomingOrganized, pastOrganized,
      pendingInvites
  } = useMemo(() => {
    if (!currentUserProfile) return { upcomingAll: [], pastAll: [], upcomingInvited: [], pastInvited: [], upcomingOrganized: [], pastOrganized: [], pendingInvites: [] };

    const now = new Date();
    const sortFn = (a: Meeting, b: Meeting) => {
        if (!a.date || !b.date) return 0;
        return a.date - b.date || a.time.localeCompare(b.time);
    };

    const allMyMeetings = meetings.filter(m => m.organizerId === currentUserProfile.id || m.attendees.some(a => a.userId === currentUserProfile.id));

    const upcoming: Meeting[] = [];
    const past: Meeting[] = [];

    allMyMeetings.forEach(m => {
        if (!m.date || !m.time) {
            past.push(m);
            return;
        }
        const meetingDate = new Date(m.date);
        const [timePart, modifier] = m.time.split(' ');
        let [hours, minutes] = timePart.split(':').map(Number);
        if (modifier && modifier.toUpperCase() === 'PM' && hours < 12) hours += 12;
        if (modifier && modifier.toUpperCase() === 'AM' && hours === 12) hours = 0;
        const startDate = new Date(meetingDate.getFullYear(), meetingDate.getMonth(), meetingDate.getDate(), hours, minutes);
        const endDate = addMinutes(startDate, m.durationInMinutes || 50);

        if (isPast(endDate)) {
            past.push(m);
        } else {
            upcoming.push(m);
        }
    });
    
    upcoming.sort(sortFn);
    past.sort((a,b) => (b.date || 0) - (a.date || 0));

    const pending = upcoming.filter(m => {
        const attendee = m.attendees.find(a => a.userId === currentUserProfile.id);
        return attendee?.status === 'pending';
    });

    return {
        upcomingAll: upcoming,
        pastAll: past,
        upcomingInvited: upcoming.filter(m => m.organizerId !== currentUserProfile.id),
        pastInvited: past.filter(m => m.organizerId !== currentUserProfile.id),
        upcomingOrganized: upcoming.filter(m => m.organizerId === currentUserProfile.id),
        pastOrganized: past.filter(m => m.organizerId === currentUserProfile.id),
        pendingInvites: pending
    };
  }, [meetings, currentUserProfile]);
  
  const handleRespond = async (meetingId: string, status: MeetingAttendeeStatus, reason?: string) => {
    try {
        await respondToMeeting(meetingId, status, reason);
        toast({ title: "Response Sent", description: `You have ${status} the meeting.`});
    } catch (e) {
        toast({ variant: "destructive", title: "Error", description: "Could not send response."});
        console.error(e);
    }
  };
  
  const handleDelete = async (meetingId: string) => {
    try {
        await deleteMeeting(meetingId);
        toast({ title: "Meeting Cancelled", description: "Attendees will be notified."});
    } catch (e) {
        toast({ variant: "destructive", title: "Error", description: "Could not cancel the meeting."});
        console.error(e);
    }
  };

  const renderMeetingSection = (upcoming: Meeting[], past: Meeting[], noUpcomingMsg: string, noPastMsg: string, emptyMsg: string, emptySubMsg: string) => {
    if (upcoming.length === 0 && past.length === 0) {
        return (
            <div className="text-center py-20 text-muted-foreground border rounded-lg">
                <p className="text-lg font-medium">{emptyMsg}</p>
                <p>{emptySubMsg}</p>
            </div>
        );
    }
    return (
        <div className="space-y-4">
            {upcoming.length > 0 ? (
                <MeetingList meetings={upcoming} onRespond={handleRespond} onDelete={handleDelete} />
            ) : (
                <div className="text-center py-10 text-muted-foreground border rounded-lg">
                    <p>{noUpcomingMsg}</p>
                </div>
            )}
            {past.length > 0 && (
                <Accordion type="single" collapsible className="w-full" defaultValue="">
                    <AccordionItem value="past-meetings">
                        <AccordionTrigger className="text-lg font-semibold">Past Meetings ({past.length})</AccordionTrigger>
                        <AccordionContent>
                           <div className="pt-4 space-y-4">
                            <MeetingList meetings={past} onRespond={handleRespond} onDelete={handleDelete} />
                           </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            )}
        </div>
    )
  }

  if (loading || authLoading) {
    return <div className="flex items-center justify-center min-h-screen"><p>Loading meetings...</p></div>;
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <header className="mb-8 flex justify-between items-center">
        <div>
            <h1 className="text-4xl font-bold tracking-tight">My Meetings</h1>
            <p className="text-muted-foreground mt-2">Manage your scheduled meetings and invitations.</p>
        </div>
        {hasAdminPrivileges && <ScheduleMeetingFromMeetingsPage />}
      </header>
      
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All Meetings</TabsTrigger>
          <TabsTrigger value="invitations">
            Meeting Invitations
            {pendingInvites.length > 0 && <Badge className="ml-2">{pendingInvites.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="organized">Organized by Me</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="pt-4">
            {renderMeetingSection(upcomingAll, pastAll, "No upcoming meetings.", "No past meetings.", "No meetings yet", "You haven't been invited to or organized any meetings.")}
        </TabsContent>
        <TabsContent value="invitations" className="pt-4">
            {renderMeetingSection(upcomingInvited, pastInvited, "No upcoming invitations.", "No past invitations.", "No invitations yet", "You haven't been invited to any meetings.")}
        </TabsContent>
        <TabsContent value="organized" className="pt-4">
            {renderMeetingSection(upcomingOrganized, pastOrganized, "No upcoming organized meetings.", "No past organized meetings.", "You haven't organized any meetings", "Schedule a meeting from the 'View Schedule' page.")}
        </TabsContent>
      </Tabs>
    </div>
  );
}

    