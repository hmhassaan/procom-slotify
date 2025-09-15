
"use client";

import { useState, useEffect } from "react";
import * as xlsx from "xlsx";
import {
  FileUp,
  Loader2,
  AlertCircle,
  Users,
  Trash2,
} from "lucide-react";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppContext } from "@/context/AppContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { SlotCoursesIndex } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const norm = (s: unknown) =>
  (s ?? "")
    .toString()
    .replace(/\s*\n\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

export default function AdminPage() {
  const { users, deleteUser, setScheduleData, clearAllUsers, loading } = useAppContext();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { currentUser, isAdminBypass, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !isAdminBypass) {
      toast({ variant: "destructive", title: "Unauthorized", description: "You do not have access to this page." });
      router.push("/");
    }
  }, [currentUser, isAdminBypass, authLoading, router, toast]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = xlsx.read(data, { type: "array" });
        const normalizedMap = new Map<string, string>();
        workbook.SheetNames.forEach(name => {
          normalizedMap.set(name.trim().toLowerCase(), name);
        });

        const selectedSheetNames: string[] = [];
        for (const d of weekdays) {
          const key = d.toLowerCase();
          const real = normalizedMap.get(key);
          if (real) selectedSheetNames.push(real);
        }

        if (selectedSheetNames.length === 0) {
          throw new Error("Excel file must contain weekday sheets (Monday–Friday).");
        }

        const firstSheet = workbook.Sheets[selectedSheetNames[0]];
        if (!firstSheet || !firstSheet["!ref"]) throw new Error("Invalid sheet format.");

        const range = xlsx.utils.decode_range(firstSheet["!ref"]);
        let timeRow = -1;
        for (let r = range.s.r; r <= range.e.r; r++) {
          const cell = firstSheet[xlsx.utils.encode_cell({ c: 0, r })];
          if (cell && typeof cell.v === "string" && cell.v.toLowerCase().includes("venues/time")) {
            timeRow = r;
            break;
          }
        }
        if (timeRow < 0) throw new Error("Couldn't locate the 'Venues/time' header row.");

        const newTimeSlots: string[] = [];
        for (let c = 1; c <= range.e.c; c++) {
          const cell = firstSheet[xlsx.utils.encode_cell({ c, r: timeRow })];
          const val = norm(cell?.v);
          if (val) newTimeSlots.push(val);
        }
        if (newTimeSlots.length === 0) throw new Error("No time slots found on the 'Venues/time' row.");
        
        let classHeaderRow = -1;
        for (let r = timeRow + 1; r <= range.e.r; r++) {
          const cell = firstSheet[xlsx.utils.encode_cell({ c: 0, r })];
          if (cell && typeof cell.v === "string" && cell.v.toLowerCase().includes("classrooms")) {
            classHeaderRow = r;
            break;
          }
        }
        if (classHeaderRow < 0) throw new Error("Couldn't locate the 'CLASSROOMS' header row.");

        const slotIdx: SlotCoursesIndex = {};
        const courseSet = new Set<string>();

        for (const day of weekdays) {
          const wsName = normalizedMap.get(day.toLowerCase());
          if (!wsName) continue;

          const sheet = workbook.Sheets[wsName];
          if (!sheet || !sheet["!ref"]) continue;

          const r = xlsx.utils.decode_range(sheet["!ref"]);
          slotIdx[day] = {};

          for (let cIdx = 0; cIdx < newTimeSlots.length; cIdx++) {
            const c = 1 + cIdx;
            const time = newTimeSlots[cIdx];
            const coursesThisSlot: string[] = [];

            for (let rr = classHeaderRow + 1; rr <= r.e.r; rr++) {
              const cell = sheet[xlsx.utils.encode_cell({ c, r: rr })];
              const val = norm(cell?.v);
              if (!val) continue;

              coursesThisSlot.push(val);
              courseSet.add(val);
            }
            slotIdx[day][time] = Array.from(new Set(coursesThisSlot));
          }
        }
        
        const newAllCourses = Array.from(courseSet).sort((a, b) => a.localeCompare(b));
        
        await setScheduleData({
            slotCourses: slotIdx,
            allCourses: newAllCourses,
            timeSlots: newTimeSlots,
        });

        toast({ title: "Success", description: "Timetable updated successfully." });
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "An unknown error occurred during file processing.");
      } finally {
        setIsUploading(false);
      }
    };
    reader.onerror = () => {
      setError("Failed to read the file.");
      setIsUploading(false);
    };
    reader.readAsArrayBuffer(file);
    event.target.value = "";
  };
  
  const pageLoading = loading || authLoading;

  if (pageLoading) {
     return (
        <div className="flex items-center justify-center min-h-screen">
          <p>Loading...</p>
        </div>
      );
  }

  if (!currentUser || !isAdminBypass) {
    return null;
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
       <header className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-bold font-headline text-primary tracking-tight">
          Admin Panel
        </h1>
      </header>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileUp className="w-6 h-6" />
              Upload/Update Timetable
            </CardTitle>
            <CardDescription>
              Select an Excel file to set or update the schedule. User data will be retained for existing courses.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              id="excel-file"
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileChange}
              disabled={isUploading}
              className="file:text-primary file:font-semibold"
            />
            {isUploading && (
              <div className="flex items-center justify-center mt-4 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </div>
            )}
            {error && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-6 h-6" />
                Manage Users
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={users.length === 0}>
                    <Trash2 className="mr-2 h-4 w-4" /> Clear All
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete all users.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={async () => {
                      await clearAllUsers();
                      toast({ title: "Success", description: "All users have been deleted." });
                    }}>
                      Continue
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardTitle>
            <CardDescription>View and remove user profiles from the system.</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-2 pr-4">
                {users.length > 0 ? (
                  users.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div>
                        <p className="font-semibold">{user.name}</p>
                        <p className="text-sm text-muted-foreground">{user.team} - {user.position}</p>
                        <p className="text-sm text-muted-foreground">{user.courses.length} courses</p>
                        {user.offDays.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">Off: {user.offDays.join(", ")}</p>
                        )}
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete {user.name}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. Are you sure you want to delete this user?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={async () => {
                              await deleteUser(user.id);
                              toast({ title: "User Deleted", description: `${user.name} has been removed.` });
                            }}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center pt-10">No users added yet.</p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
