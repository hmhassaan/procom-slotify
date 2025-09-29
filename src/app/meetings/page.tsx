

"use client";

import { useState, useEffect, useMemo } from "react";
import { useAppContext } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, X, Calendar, User, Users, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Meeting, MeetingAttendeeStatus } from "@/app/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const MeetingCard = ({ meeting, isOrganizer, onRespond, onDelete }: { meeting: Meeting, isOrganizer: boolean, onRespond: (meetingId: string, status: MeetingAttendeeStatus, reason?: string) => void, onDelete: (meetingId: string) => void }) => {
  const { currentUserProfile } = useAppContext();
  const [isDeclineDialogOpen, setIsDeclineDialogOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  
  const currentUserAttendee = meeting.attendees.find(a => a.userId === currentUserProfile?.id);
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>{meeting.title}</CardTitle>
        <CardDescription className="flex items-center gap-4 pt-2 text-sm">
          <span className="flex items-center gap-2"><Calendar className="w-4 h-4"/>{meeting.day}, {meeting.time}</span>
          <span className="flex items-center gap-2"><User className="w-4 h-4"/>Organized by {meeting.organizerName}</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <h4 className="font-semibold flex items-center gap-2"><Users className="w-4 h-4" />Attendees ({meeting.attendees.length})</h4>
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
                                {getStatusBadge(attendee.status)}
                           </div>
                        </TooltipTrigger>
                         <TooltipContent>
                           {attendee.status === 'declined' && attendee.responseReason ? <p>Reason: {attendee.responseReason}</p> : <p>Status: {attendee.status}</p>}
                        </TooltipContent>
                    </Tooltip>
                 </TooltipProvider>
              ))}
            </div>
          </div>
          {!isOrganizer && currentUserStatus && currentUserStatus !== 'organizer' && (
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
          {isOrganizer && (
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
      </CardContent>
    </Card>
  );
};


export default function MeetingsPage() {
  const { meetings, currentUserProfile, loading, respondToMeeting, deleteMeeting } = useAppContext();
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push("/login");
    }
  }, [currentUser, authLoading, router]);

  const { allMeetings, organizedMeetings, invitedMeetings, pendingInvites } = useMemo(() => {
    if (!currentUserProfile) return { allMeetings: [], organizedMeetings: [], invitedMeetings: [], pendingInvites: [] };
    
    const organized = meetings.filter(m => m.organizerId === currentUserProfile.id);
    const invited = meetings.filter(m => m.organizerId !== currentUserProfile.id && m.attendees.some(a => a.userId === currentUserProfile.id));
    const all = [...organized, ...invited].sort((a,b) => b.createdAt - a.createdAt);
    const pending = invited.filter(m => m.attendees.find(a => a.userId === currentUserProfile.id)?.status === 'pending');
    
    return { allMeetings: all, organizedMeetings: organized, invitedMeetings: invited, pendingInvites: pending };
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

  if (loading || authLoading) {
    return <div className="flex items-center justify-center min-h-screen"><p>Loading meetings...</p></div>;
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <header className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight">My Meetings</h1>
        <p className="text-muted-foreground mt-2">Manage your scheduled meetings and invitations.</p>
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
        <TabsContent value="all" className="space-y-4 pt-4">
          {allMeetings.length > 0 ? (
            allMeetings.map(m => <MeetingCard key={m.id} meeting={m} isOrganizer={m.organizerId === currentUserProfile?.id} onRespond={handleRespond} onDelete={handleDelete} />)
          ) : (
            <div className="text-center py-20 text-muted-foreground border rounded-lg">
                <p className="text-lg font-medium">No meetings yet</p>
                <p>You haven't been invited to or organized any meetings.</p>
            </div>
          )}
        </TabsContent>
        <TabsContent value="invitations" className="space-y-4 pt-4">
          {invitedMeetings.length > 0 ? (
            invitedMeetings.map(m => <MeetingCard key={m.id} meeting={m} isOrganizer={false} onRespond={handleRespond} onDelete={handleDelete} />)
          ) : (
            <div className="text-center py-20 text-muted-foreground border rounded-lg">
                <p className="text-lg font-medium">No invitations yet</p>
                <p>You haven't been invited to any meetings.</p>
            </div>
          )}
        </TabsContent>
        <TabsContent value="organized" className="space-y-4 pt-4">
           {organizedMeetings.length > 0 ? (
            organizedMeetings.map(m => <MeetingCard key={m.id} meeting={m} isOrganizer={true} onRespond={handleRespond} onDelete={handleDelete} />)
          ) : (
            <div className="text-center py-20 text-muted-foreground border rounded-lg">
                <p className="text-lg font-medium">You haven't organized any meetings</p>
                <p>Schedule a meeting from the 'View Schedule' page.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
