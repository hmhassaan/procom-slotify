"use client";

import { useState } from "react";
import * as xlsx from "xlsx";
import {
  FileUp,
  Loader2,
  BookUser,
  CalendarDays,
  AlertCircle,
  Users,
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

export default function CourseExtractorApp() {
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [allCourses, setAllCourses] = useState<string[]>([]);
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [newUserName, setNewUserName] = useState("");
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
        const sheetNames = workbook.SheetNames.slice(0, 5); // Monday to Friday

        if (sheetNames.length === 0) {
            throw new Error("Excel file must contain at least one sheet for Monday.");
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

        sheetNames.forEach(day => {
            const sheet = workbook.Sheets[day];
            newSchedule[day] = {};
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
    
    const newUser: User = { id: Date.now().toString(), name: newUserName, courses: userCourses };
    setUsers([...users, newUser]);
    setNewUserName("");
    setSelectedCourses({});
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
            Select an Excel file (.xlsx, .xls) to begin.
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
            <div>
                <Label htmlFor="user-name" className="font-semibold">New User Name</Label>
                <Input id="user-name" placeholder="e.g., Alex Doe" value={newUserName} onChange={(e) => setNewUserName(e.target.value)} className="mt-2" />
                <h4 className="font-semibold mt-4 mb-2">Select Courses</h4>
                <ScrollArea className="h-48 rounded-md border p-4">
                    <div className="space-y-2">
                    {allCourses.map(course => (
                        <div key={course} className="flex items-center space-x-2">
                            <Checkbox id={course} checked={selectedCourses[course] || false} onCheckedChange={(checked) => setSelectedCourses(prev => ({...prev, [course]: !!checked}))} />
                            <Label htmlFor={course} className="font-normal">{course}</Label>
                        </div>
                    ))}
                    </div>
                </ScrollArea>
                <Button onClick={handleAddUser} className="mt-4 w-full">Add User</Button>
            </div>
            <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2"><Users className="w-5 h-5"/>Added Users</h4>
                <ScrollArea className="h-72">
                    <div className="space-y-2 pr-4">
                    {users.length > 0 ? users.map(user => (
                        <div key={user.id} className="p-3 bg-muted rounded-lg">
                            <p className="font-semibold">{user.name}</p>
                            <p className="text-sm text-muted-foreground">{user.courses.length} courses</p>
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
                                    <span className="text-muted-foreground">No free slots on this day.</span>
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
