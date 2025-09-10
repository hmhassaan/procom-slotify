"use client";

import { useState, useMemo } from "react";
import * as xlsx from "xlsx";
import {
  FileUp,
  Loader2,
  BookUser,
  CalendarDays,
  AlertCircle,
  Users,
  Search,
} from "lucide-react";

import type { Schedule, User, FreeSlots } from "@/app/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea, ScrollBar } from "./ui/scroll-area";

const teams = ["ExCom/Core", "CS Competitions", "AI Competitions", "Web Development", "Automation"];
const positions = ["Executive", "Mentor", "Head", "Co-head", "Deputy Head", "Module Head", "Module Cohead", "Member"];
const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export default function CourseExtractorApp() {
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [allCourses, setAllCourses] = useState<string[]>([]);
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [newUserName, setNewUserName] = useState("");
  const [newUserTeam, setNewUserTeam] = useState("");
  const [newUserPosition, setNewUserPosition] = useState("");
  const [offDays, setOffDays] = useState<Record<string, boolean>>({});
  const [courseSearchTerm, setCourseSearchTerm] = useState("");
  const [selectedCourses, setSelectedCourses] = useState<Record<string, boolean>>({});
  const [selectedUserForAnalysis, setSelectedUserForAnalysis] = useState<string>("");
  const [freeSlots, setFreeSlots] = useState<FreeSlots | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);
    setSchedule(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = xlsx.read(data, { type: "array" });
        const lowerCaseWeekdays = weekdays.map(d => d.toLowerCase());
        const sheetNames = workbook.SheetNames.filter(name => 
            lowerCaseWeekdays.includes(name.toLowerCase())
        );

        if (sheetNames.length === 0) {
            throw new Error("Excel file must contain sheets named Monday, Tuesday, etc.");
        }

        const firstSheet = workbook.Sheets[sheetNames[0]];
        const newTimeSlots: string[] = [];
        for (let C = 1; C <= 9; ++C) { // B3-J3
            const cellAddress = xlsx.utils.encode_cell({ c: C, r: 2 });
            const cell = firstSheet[cellAddress];
            newTimeSlots.push(cell?.v?.toString() ?? `Slot ${C}`);
        }
        setTimeSlots(newTimeSlots);

        const newSchedule: Schedule = {};
        const coursesSet = new Set<string>();

        weekdays.forEach(day => {
            const sheetName = sheetNames.find(s => s.toLowerCase() === day.toLowerCase());
            newSchedule[day] = {};

            if (sheetName) {
                const sheet = workbook.Sheets[sheetName];
                for (let C = 1; C <= 9; C++) { // Cols B-J
                    const time = newTimeSlots[C - 1];
                    for (let R = 4; R < 72; R++) { // Rows 5-72
                        const cellAddress = xlsx.utils.encode_cell({ c: C, r: R });
                        const cell = sheet[cellAddress];
                        if (cell?.v) {
                            const courseName = cell.v.toString().trim();
                            if (courseName && !newSchedule[day][time]) {
                               newSchedule[day][time] = courseName;
                               coursesSet.add(courseName);
                               break; 
                            }
                        }
                    }
                }
            }
        });

        setSchedule(newSchedule);
        setAllCourses(Array.from(coursesSet).sort());
        toast({ title: "Success", description: "Timetable extracted successfully." });
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "An unknown error occurred during file processing.");
      } finally {
        setIsLoading(false);
      }
    };
    reader.onerror = () => {
        setError("Failed to read the file.");
        setIsLoading(false);
    };
    reader.readAsArrayBuffer(file);
    event.target.value = ''; // Allow re-uploading the same file
  };

  const handleAddUser = () => {
    if (!newUserName.trim()) {
        toast({ variant: "destructive", title: "Error", description: "Please enter a user name." });
        return;
    }
    const userCourses = Object.entries(selectedCourses).filter(([, isSelected]) => isSelected).map(([course]) => course);
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

    const newUser: User = { id: Date.now().toString(), name: newUserName, courses: userCourses, team: newUserTeam, position: newUserPosition, offDays: userOffDays };
    setUsers([...users, newUser]);
    setNewUserName("");
    setNewUserTeam("");
    setNewUserPosition("");
    setSelectedCourses({});
    setOffDays({});
    setCourseSearchTerm("");
    toast({ title: "User Added", description: `${newUser.name} has been added.` });
  };
  
  const handleAnalyzeSchedule = () => {
    if (!selectedUserForAnalysis || !schedule) {
        toast({ variant: "destructive", title: "Error", description: "Please select a user to analyze." });
        return;
    }

    const user = users.find(u => u.id === selectedUserForAnalysis);
    if (!user) return;

    const busySlots: { [day: string]: Set<string> } = {};
    Object.keys(schedule).forEach(day => {
        busySlots[day] = new Set();
        // If it's an off day, all slots are busy
        if (user.offDays.includes(day)) {
            timeSlots.forEach(time => busySlots[day].add(time));
            return;
        }
        Object.entries(schedule[day]).forEach(([time, course]) => {
            if (course && user.courses.includes(course)) {
                busySlots[day].add(time);
            }
        });
    });

    const newFreeSlots: FreeSlots = {};
    Object.keys(schedule).forEach(day => {
        newFreeSlots[day] = timeSlots.filter(time => !busySlots[day].has(time));
    });

    setFreeSlots(newFreeSlots);
  };

  const filteredCourses = useMemo(() => {
    if (!courseSearchTerm) {
      return allCourses;
    }
    return allCourses.filter(course =>
      course.toLowerCase().includes(courseSearchTerm.toLowerCase())
    );
  }, [allCourses, courseSearchTerm]);

  const isStep2Disabled = !schedule;
  const isStep3Disabled = users.length === 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileUp className="w-6 h-6" />
            Step 1: Upload Timetable
          </CardTitle>
          <CardDescription>
            Select an Excel file (.xlsx, .xls) with sheets named by weekdays.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Input id="excel-file" type="file" accept=".xlsx, .xls" onChange={handleFileChange} disabled={isLoading} className="file:text-primary file:font-semibold"/>
          {isLoading && <div className="flex items-center justify-center mt-4 text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</div>}
          {error && <Alert variant="destructive" className="mt-4"><AlertCircle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
        </CardContent>
      </Card>

      <Card className={`lg:col-span-2 ${isStep2Disabled ? "opacity-50 pointer-events-none" : ""}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookUser className="w-6 h-6" />
            Step 2: Create Users
          </CardTitle>
          <CardDescription>Add users and assign their enrolled courses.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
                <div>
                    <Label htmlFor="user-name" className="font-semibold">New User Name</Label>
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
                                {teams.map(team => <SelectItem key={team} value={team}>{team}</SelectItem>)}
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
                                {positions.map(pos => <SelectItem key={pos} value={pos}>{pos}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div>
                    <Label className="font-semibold">Off Days</Label>
                    <div className="flex flex-wrap gap-x-4 gap-y-2 mt-2">
                        {weekdays.map(day => (
                            <div key={day} className="flex items-center space-x-2">
                                <Checkbox id={`off-${day}`} checked={offDays[day] || false} onCheckedChange={(checked) => setOffDays(prev => ({...prev, [day]: !!checked}))} />
                                <Label htmlFor={`off-${day}`} className="font-normal">{day}</Label>
                            </div>
                        ))}
                    </div>
                </div>
                 <div>
                    <Label htmlFor="course-search" className="font-semibold">Select Courses</Label>
                    <div className="relative mt-2">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="course-search" placeholder="Search for a course..." value={courseSearchTerm} onChange={(e) => setCourseSearchTerm(e.target.value)} className="pl-10" />
                    </div>
                    <ScrollArea className="h-40 rounded-md border p-4 mt-2">
                        <div className="space-y-2">
                        {filteredCourses.length > 0 ? filteredCourses.map(course => (
                            <div key={course} className="flex items-center space-x-2">
                                <Checkbox id={course} checked={selectedCourses[course] || false} onCheckedChange={(checked) => setSelectedCourses(prev => ({...prev, [course]: !!checked}))} />
                                <Label htmlFor={course} className="font-normal">{course}</Label>
                            </div>
                        )) : <p className="text-sm text-center text-muted-foreground">No courses found.</p>}
                        </div>
                    </ScrollArea>
                 </div>
                <Button onClick={handleAddUser} className="w-full">Add User</Button>
            </div>
            <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2"><Users className="w-5 h-5"/>Added Users</h4>
                <ScrollArea className="h-[520px]">
                    <div className="space-y-2 pr-4">
                    {users.length > 0 ? users.map(user => (
                        <div key={user.id} className="p-3 bg-muted rounded-lg">
                            <p className="font-semibold">{user.name}</p>
                            <p className="text-sm text-muted-foreground">{user.team} - {user.position}</p>
                            <p className="text-sm text-muted-foreground">{user.courses.length} courses</p>
                             {user.offDays.length > 0 && <p className="text-xs text-muted-foreground mt-1">Off: {user.offDays.join(', ')}</p>}
                        </div>
                    )) : <p className="text-sm text-muted-foreground text-center pt-10">No users added yet.</p>}
                    </div>
                </ScrollArea>
            </div>
        </CardContent>
      </Card>

      <Card className={`lg:col-span-3 ${isStep3Disabled ? "opacity-50 pointer-events-none" : ""}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="w-6 h-6" />
            Step 3: Analyze Schedule
          </CardTitle>
          <CardDescription>
            Select a user to find their free time slots throughout the week.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <Select onValueChange={setSelectedUserForAnalysis} value={selectedUserForAnalysis}>
              <SelectTrigger className="w-full sm:w-[280px]">
                <SelectValue placeholder="Select a user..." />
              </SelectTrigger>
              <SelectContent>
                {users.map(user => (
                  <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleAnalyzeSchedule} className="w-full sm:w-auto">Analyze Schedule</Button>
          </div>
          {freeSlots && (
            <div className="mt-6">
                <h3 className="font-bold text-lg mb-4">Free Time Slots for {users.find(u => u.id === selectedUserForAnalysis)?.name}</h3>
                <ScrollArea>
                    <Table>
                        <TableHeader>
                        <TableRow>
                            <TableHead className="w-[150px]">Day</TableHead>
                            <TableHead>Available Slots</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {Object.entries(freeSlots).map(([day, slots]) => (
                            <TableRow key={day}>
                            <TableCell className="font-medium">{day}</TableCell>
                            <TableCell>
                                {slots.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {slots.map(slot => (
                                            <span key={slot} className="bg-accent text-accent-foreground px-2 py-1 rounded-md text-xs">{slot}</span>
                                        ))}
                                    </div>
                                ) : (
                                    <span className="text-muted-foreground">{users.find(u=>u.id === selectedUserForAnalysis)?.offDays.includes(day) ? "Off day" : "No free slots on this day."}</span>
                                )}
                            </TableCell>
                            </TableRow>
                        ))}
                        </TableBody>
                    </Table>
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
