
"use client";

import React, { useState, useEffect, useMemo } from "react";
import * as xlsx from "xlsx";
import { FileUp, Loader2, AlertCircle, Users, Trash2, Tag, PlusCircle, Building2, Briefcase, UserCog, Shield, ShieldCheck, ShieldAlert, Crown, GripVertical, Pencil } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppContext } from "@/context/AppContext";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import type { SlotCoursesIndex, CategoryData, User, UserRole, Position } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multi-select";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { PopoverContent } from "@/components/ui/popover";

const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const norm = (s: unknown) => (s ?? "").toString().replace(/\s*\n\s*/g, " ").replace(/\s{2,}/g, " ").trim();

let idCounter = 0;
const generateUniqueId = () => `${Date.now()}-${idCounter++}`;

const SortablePositionItem = ({ position, onRemove, onEdit }: { position: Position; onRemove: (id: string) => void; onEdit: (position: Position) => void; }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: position.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const { isUniversalAdmin } = useAuth();

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 bg-muted rounded-lg p-2">
      <button {...attributes} {...listeners} className="cursor-grab p-1" disabled={!isUniversalAdmin}>
        <GripVertical className="w-5 h-5 text-muted-foreground" />
      </button>
      <span className="w-6 text-center">{position.icon}</span>
      <span className="flex-grow">{position.name}</span>
      <Button variant="ghost" size="icon" onClick={() => onEdit(position)} disabled={!isUniversalAdmin}>
        <Pencil className="w-4 h-4" />
      </Button>
      <Button variant="ghost" size="icon" onClick={() => onRemove(position.id)} disabled={!isUniversalAdmin}>
        <Trash2 className="w-4 h-4 hover:text-destructive" />
      </Button>
    </div>
  );
};


const CategoryManager = () => {
  const { teams, positions, subTeams, updateCategories, loading } = useAppContext();
  const { isUniversalAdmin, isExecutiveAdmin, currentUserProfile } = useAuth();

  const [newTeam, setNewTeam] = useState("");
  
  const [isPositionDialogOpen, setIsPositionDialogOpen] = useState(false);
  const [currentPosition, setCurrentPosition] = useState<Position | null>(null);
  const [positionName, setPositionName] = useState("");
  const [positionIcon, setPositionIcon] = useState("");

  const [newSubTeam, setNewSubTeam] = useState("");
  const [parentTeam, setParentTeam] = useState("");
  const { toast } = useToast();
  
  const canManageTeams = isUniversalAdmin;
  const canManagePositions = isUniversalAdmin;
  const canManageSubTeams = isUniversalAdmin || isExecutiveAdmin;

  const handleAddTeam = async () => {
    if (!newTeam.trim() || !canManageTeams) return;
    const updatedCategories: CategoryData = { teams: [...new Set([...teams, newTeam.trim()])], positions, subTeams };
    await updateCategories(updatedCategories);
    setNewTeam("");
    toast({ title: "Success", description: "Team added." });
  };

  const handleRemoveTeam = async (value: string) => {
    if (!canManageTeams) return;
    let updatedCategories: CategoryData = { 
        teams: teams.filter(t => t !== value), 
        positions, 
        subTeams: { ...subTeams }
    };
    if (updatedCategories.subTeams[value]) {
        delete updatedCategories.subTeams[value];
    }
    await updateCategories(updatedCategories);
    toast({ title: "Success", description: "Team removed." });
  };
  
  const handleOpenPositionDialog = (position: Position | null) => {
    setCurrentPosition(position);
    setPositionName(position?.name || "");
    setPositionIcon(position?.icon || "");
    setIsPositionDialogOpen(true);
  };
  
  const handleSavePosition = async () => {
    if (!positionName.trim() || !canManagePositions) return;

    let updatedPositions: Position[];
    if (currentPosition) { // Editing existing
        updatedPositions = positions.map(p => p.id === currentPosition.id ? { ...p, name: positionName, icon: positionIcon } : p);
    } else { // Adding new
        const newPosition: Position = { id: generateUniqueId(), name: positionName.trim(), icon: positionIcon };
        updatedPositions = [...positions, newPosition];
    }

    await updateCategories({ teams, positions: updatedPositions, subTeams });
    toast({ title: "Success", description: `Position ${currentPosition ? 'updated' : 'added'}.` });
    setIsPositionDialogOpen(false);
  };
  
  const handleRemovePosition = async (id: string) => {
    if (!canManagePositions) return;
    const updatedPositions = positions.filter(p => p.id !== id);
    await updateCategories({ teams, positions: updatedPositions, subTeams });
    toast({ title: "Success", description: "Position removed." });
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldIndex = positions.findIndex((p) => p.id === active.id);
      const newIndex = positions.findIndex((p) => p.id === over!.id);
      const reorderedPositions = arrayMove(positions, oldIndex, newIndex);
      await updateCategories({ teams, positions: reorderedPositions, subTeams });
    }
  };


  const handleAddSubTeam = async () => {
    if (!newSubTeam.trim() || !parentTeam || !canManageSubTeams) return;
    if (isExecutiveAdmin && !currentUserProfile?.teams?.includes(parentTeam)) {
        toast({ variant: "destructive", title: "Unauthorized", description: "You can only add sub-teams to your own teams." });
        return;
    }
    const updatedSubTeams = { ...subTeams };
    const parentSubTeams = updatedSubTeams[parentTeam] || [];
    updatedSubTeams[parentTeam] = [...new Set([...parentSubTeams, newSubTeam.trim()])];
    
    await updateCategories({ teams, positions, subTeams: updatedSubTeams });
    setNewSubTeam("");
    setParentTeam("");
    toast({ title: "Success", description: "Sub-team added." });
  };

  const handleRemoveSubTeam = async (value: string, parent: string) => {
     if (!canManageSubTeams) return;
     if (isExecutiveAdmin && !currentUserProfile?.teams?.includes(parent)) {
        toast({ variant: "destructive", title: "Unauthorized", description: "You can only remove sub-teams from your own teams." });
        return;
      }
    const updatedSubTeams = { ...subTeams };
    const parentSubTeams = updatedSubTeams[parent] || [];
    updatedSubTeams[parent] = parentSubTeams.filter(st => st !== value);

    await updateCategories({ teams, positions, subTeams: updatedSubTeams });
    toast({ title: "Success", description: "Sub-team removed." });
  };

  if (loading) return <p>Loading categories...</p>;

  return (
    <Card className="lg:col-span-3">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Tag className="w-6 h-6" /> Manage Categories
        </CardTitle>
        <CardDescription>Add, remove, or reorder teams, positions, and sub-teams.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-3">
          <h3 className="font-semibold flex items-center gap-2"><Building2 className="w-5 h-5" /> Teams</h3>
          <div className="flex gap-2">
            <Input value={newTeam} onChange={(e) => setNewTeam(e.target.value)} placeholder="New Team" disabled={!canManageTeams} />
            <Button onClick={handleAddTeam} size="icon" disabled={!canManageTeams}><PlusCircle className="w-4 h-4" /></Button>
          </div>
          <ScrollArea className="h-40 rounded-md border p-2">
            <div className="flex flex-col gap-2">
              {teams.map(team => (
                <Badge key={team} variant="secondary" className="flex justify-between items-center p-2">
                  <span>{team}</span>
                  <button onClick={() => handleRemoveTeam(team)} disabled={!canManageTeams}><Trash2 className="w-3 h-3 hover:text-destructive" /></button>
                </Badge>
              ))}
            </div>
          </ScrollArea>
        </div>

        <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2"><Briefcase className="w-5 h-5" /> Positions</h3>
            <div className="flex gap-2">
                <Button onClick={() => handleOpenPositionDialog(null)} className="w-full" disabled={!canManagePositions}>
                    <PlusCircle className="w-4 h-4 mr-2" /> Add New Position
                </Button>
            </div>
            <ScrollArea className="h-40 rounded-md border p-2">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={positions.map(p => p.id)} strategy={verticalListSortingStrategy}>
                        <div className="flex flex-col gap-2">
                            {positions.map(pos => (
                                <SortablePositionItem key={pos.id} position={pos} onRemove={handleRemovePosition} onEdit={handleOpenPositionDialog} />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            </ScrollArea>
        </div>

        <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2"><Tag className="w-5 h-5" /> Sub-teams</h3>
            <div className="flex gap-2">
                <Select value={parentTeam} onValueChange={setParentTeam} disabled={!canManageSubTeams}>
                    <SelectTrigger><SelectValue placeholder="Select Team" /></SelectTrigger>
                    <SelectContent>
                        {(isExecutiveAdmin ? (currentUserProfile?.teams || []) : teams).map(team => <SelectItem key={team} value={team}>{team}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Input value={newSubTeam} onChange={(e) => setNewSubTeam(e.target.value)} placeholder="New Sub-team" disabled={!parentTeam} />
                <Button onClick={handleAddSubTeam} size="icon" disabled={!parentTeam || !newSubTeam}><PlusCircle className="w-4 h-4" /></Button>
            </div>
            <ScrollArea className="h-40 rounded-md border p-2">
                <div className="flex flex-col gap-2">
                    {Object.entries(subTeams).map(([parent, subs]) => (
                         ((isExecutiveAdmin && !currentUserProfile?.teams?.includes(parent)) ? null : (
                            <div key={parent}>
                                <h4 className="font-bold text-sm mb-1">{parent}</h4>
                                {subs.map(sub => (
                                    <Badge key={sub} variant="outline" className="flex justify-between items-center p-2 ml-2 mb-1">
                                        <span>{sub}</span>
                                        <button onClick={() => handleRemoveSubTeam(sub, parent)} disabled={!canManageSubTeams}><Trash2 className="w-3 h-3 hover:text-destructive" /></button>
                                    </Badge>
                                ))}
                            </div>
                         ))
                    ))}
                </div>
            </ScrollArea>
        </div>
      </CardContent>
       <Dialog open={isPositionDialogOpen} onOpenChange={setIsPositionDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{currentPosition ? "Edit" : "Add"} Position</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="position-name">Position Name</Label>
                <Input id="position-name" value={positionName} onChange={(e) => setPositionName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="position-icon">Icon / Emoji</Label>
                <Input id="position-icon" value={positionIcon} onChange={(e) => setPositionIcon(e.target.value)} placeholder="e.g., 👑" />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button onClick={handleSavePosition}>Save</Button>
            </DialogFooter>
          </DialogContent>
      </Dialog>
    </Card>
  );
};


const RoleDialog = ({ user, onUpdate }: { user: User, onUpdate: () => void }) => {
    const { updateUser, teams, subTeams } = useAppContext();
    const { currentUserProfile, isUniversalAdmin, isExecutiveAdmin, isTeamAdmin } = useAuth();
    const { toast } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [selectedRole, setSelectedRole] = useState<UserRole>(user.role || 'none');
    const [selectedTeams, setSelectedTeams] = useState<string[]>(user.teams || (user.team ? [user.team] : []));
    const [selectedTeam, setSelectedTeam] = useState<string>(user.team || '');
    const [selectedSubTeam, setSelectedSubTeam] = useState<string>(user.subTeam || '');

    useEffect(() => {
        setSelectedRole(user.role || 'none');
        setSelectedTeams(user.teams || (user.team ? [user.team] : []));
        setSelectedTeam(user.team || '');
        setSelectedSubTeam(user.subTeam || '');
    }, [user, isOpen]);
    
    const availableSubTeamsForTeam = useMemo(() => {
        return selectedTeam ? subTeams[selectedTeam] || [] : [];
    }, [selectedTeam, subTeams]);


    const handleSave = async () => {
        const updatedUserData: Partial<User> = { role: selectedRole };
        if (selectedRole === 'executive') {
            updatedUserData.teams = selectedTeams;
            updatedUserData.team = undefined; // clear single team
            updatedUserData.subTeam = undefined; // clear sub team
        } else if (selectedRole === 'team') {
            updatedUserData.team = selectedTeam;
            updatedUserData.teams = undefined; // clear multi-teams
            updatedUserData.subTeam = undefined; // clear sub team
        } else if (selectedRole === 'subTeam') {
            updatedUserData.team = selectedTeam;
            updatedUserData.subTeam = selectedSubTeam;
            updatedUserData.teams = undefined; // clear multi-teams
        } else { // 'none'
            updatedUserData.team = selectedTeam || user.team;
            updatedUserData.subTeam = selectedSubTeam || user.subTeam;
            updatedUserData.teams = undefined;
        }

        try {
            await updateUser(user.id, updatedUserData);
            toast({ title: "Success", description: "User role updated." });
            onUpdate();
            setIsOpen(false);
        } catch (e) {
            toast({ variant: "destructive", title: "Error", description: "Could not update user role." });
        }
    };
    
    const canSetRole = (targetUser: User, role: UserRole) => {
        if (!currentUserProfile) return false;
        if (isUniversalAdmin) return true;
        
        if (isExecutiveAdmin) {
            // Executive can't edit universal or other executives
            if (targetUser.role === 'universal' || targetUser.role === 'executive') return false;
            // Can only assign roles to users within their managed teams
            if (!currentUserProfile.teams?.includes(targetUser.team || '')) return false;
            return role === 'team' || role === 'subTeam' || role === 'none';
        }
        
        if (isTeamAdmin) {
             // Team admin can't edit any admin higher or equal
            if (targetUser.role !== 'none' && targetUser.role !== 'subTeam') return false;
            // Can only assign roles to users in their own team
            if (targetUser.team !== currentUserProfile.team) return false;
            return role === 'subTeam' || role === 'none';
        }
        return false;
    };

    const getRoleOptions = () => {
        const allRoles = [
            { value: 'none', label: 'None' },
            { value: 'universal', label: 'Universal Admin' },
            { value: 'executive', label: 'Executive Admin' },
            { value: 'team', label: 'Team Admin' },
            { value: 'subTeam', label: 'Sub-team Admin' },
        ];
        
        if (isUniversalAdmin) return allRoles;
        
        return allRoles.filter(opt => canSetRole(user, opt.value as UserRole) || opt.value === user.role);
    }
    
    const canEditTarget = useMemo(() => {
        if (!currentUserProfile) return false;
        if (isUniversalAdmin) return true; // Universal can edit anyone
        if (isExecutiveAdmin) {
            // Cannot edit universal or other executives
            if (user.role === 'universal' || user.role === 'executive') return false;
            // Can edit users within their teams
            return (currentUserProfile.teams || []).includes(user.team || '');
        }
        if (isTeamAdmin) {
            // Cannot edit universal, exec, or other team admins
            if (user.role === 'universal' || user.role === 'executive' || user.role === 'team') return false;
            // Can edit users within their own team
            return user.team === currentUserProfile.team;
        }
        // Sub-team admins and regular users cannot edit roles.
        return false;
    }, [user, currentUserProfile, isUniversalAdmin, isExecutiveAdmin, isTeamAdmin]);


    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" disabled={!canEditTarget}>
                    <UserCog className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] z-51" sideOffset={5}>
                <DialogHeader>
                    <DialogTitle>Set Role for {user.name}</DialogTitle>
                    <DialogDescription>Assign an administrative role and team access for this user.</DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div>
                        <Label htmlFor="role-select">Admin Role</Label>
                        <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as UserRole)} disabled={!canEditTarget}>
                            <SelectTrigger id="role-select">
                                <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                            <SelectContent>
                                {getRoleOptions().map(opt => (
                                    <SelectItem key={opt.value} value={opt.value} disabled={!canSetRole(user, opt.value as UserRole)}>
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {selectedRole === 'executive' && isUniversalAdmin && (
                        <div>
                            <Label>Teams</Label>
                            <MultiSelect 
                                options={teams}
                                selected={selectedTeams}
                                onChange={setSelectedTeams}
                                placeholder="Assign teams..."
                            />
                        </div>
                    )}
                    
                    {(selectedRole === 'team' || selectedRole === 'subTeam' || selectedRole === 'none') && (
                         <div>
                            <Label>Team</Label>
                            <Select value={selectedTeam} onValueChange={setSelectedTeam} disabled={!canEditTarget || selectedRole === 'executive'}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a team" />
                                </SelectTrigger>
                                <SelectContent>
                                    {(isExecutiveAdmin ? (currentUserProfile?.teams || []) : teams).map(t => (
                                        <SelectItem key={t} value={t}>{t}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    
                    {selectedRole === 'subTeam' && (
                         <div>
                            <Label>Sub-team</Label>
                             <Select value={selectedSubTeam} onValueChange={setSelectedSubTeam} disabled={!canEditTarget || !selectedTeam}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a sub-team" />
                                </SelectTrigger>
                                <SelectContent>
                                   {availableSubTeamsForTeam.map(st => (
                                        <SelectItem key={st} value={st}>{st}</SelectItem>
                                   ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                    <Button onClick={handleSave} disabled={!canEditTarget}>Save Changes</Button>
                </DialogFooter>
            </PopoverContent>
        </Dialog>
    );
};


export default function AdminPage() {
  const { users, positions, deleteUser, setScheduleData, clearAllUsers, loading } = useAppContext();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { toast } = useToast();
  const { currentUser, currentUserProfile, isUniversalAdmin, isExecutiveAdmin, isTeamAdmin, isSubTeamAdmin, hasAdminPrivileges, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!authLoading && !hasAdminPrivileges) {
      toast({ variant: "destructive", title: "Unauthorized", description: "You do not have access to this page." });
      router.push("/");
    }
  }, [hasAdminPrivileges, authLoading, router, toast]);

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

  const filteredUsers = useMemo(() => {
    if (isUniversalAdmin) return users;
    if (isExecutiveAdmin) {
        const adminTeams = currentUserProfile?.teams || [];
        return users.filter(u => adminTeams.includes(u.team || ''));
    }
    if (isTeamAdmin) {
      return users.filter(u => u.team === currentUserProfile?.team);
    }
    if (isSubTeamAdmin) {
      return users.filter(u => u.subTeam === currentUserProfile?.subTeam && u.team === currentUserProfile?.team);
    }
    return [];
  }, [users, isUniversalAdmin, isExecutiveAdmin, isTeamAdmin, isSubTeamAdmin, currentUserProfile]);

  const canDeleteUser = (userToDelete: User) => {
    if (!currentUserProfile || userToDelete.id === currentUser?.uid) return false; // Cannot delete self
    if (isUniversalAdmin) return true;
    if (isExecutiveAdmin) {
        // Can't delete universal or other executives
        if (userToDelete.role === 'universal' || userToDelete.role === 'executive') return false;
        // Can delete users in their teams
        return (currentUserProfile.teams || []).includes(userToDelete.team || '');
    }
    if (isTeamAdmin) {
        // Can only delete members or sub-team admins in their own team
        if (userToDelete.role === 'universal' || userToDelete.role === 'executive' || userToDelete.role === 'team') return false;
        return userToDelete.team === currentUserProfile.team;
    }
    if (isSubTeamAdmin) {
        // Can only delete members of their own sub-team
        if (userToDelete.role !== 'none') return false;
        return userToDelete.team === currentUserProfile.team && userToDelete.subTeam === currentUserProfile.subTeam;
    }
    return false;
  };

  const getRoleIcon = (role?: UserRole) => {
    switch (role) {
      case 'universal': return <ShieldAlert className="h-4 w-4 text-red-500" title="Universal Admin"/>;
      case 'executive': return <Crown className="h-4 w-4 text-purple-500" title="Executive Admin" />;
      case 'team': return <ShieldCheck className="h-4 w-4 text-blue-500" title="Team Admin" />;
      case 'subTeam': return <Shield className="h-4 w-4 text-green-500" title="Sub-team Admin"/>;
      default: return null;
    }
  };
  
  const getTeamDisplay = (user: User) => {
    if (user.role === 'executive') {
        return (user.teams || []).join(', ');
    }
    return user.team || 'N/A';
  }
  
  const positionMap = useMemo(() => new Map(positions.map(p => [p.name, p.icon])), [positions]);


  const pageLoading = loading || authLoading;

  if (pageLoading) {
     return (
        <div className="flex items-center justify-center min-h-screen">
          <p>Loading...</p>
        </div>
      );
  }

  if (!hasAdminPrivileges) {
    return null;
  }

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8">
       <header className="text-center">
        <h1 className="text-4xl md:text-5xl font-bold font-headline text-primary tracking-tight">
          Admin Panel
        </h1>
      </header>

      {(isUniversalAdmin || isExecutiveAdmin) && <CategoryManager />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {isUniversalAdmin && (
            <Card className="lg:col-span-1">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                <FileUp className="w-6 h-6" />
                Upload/Update Timetable
                </CardTitle>
                <CardDescription>
                Select an Excel file to set or update the schedule.
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
        )}

        <Card className={isUniversalAdmin ? "lg:col-span-2" : "lg:col-span-3"}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-6 h-6" />
                Manage Users
              </div>
              {isUniversalAdmin && (
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
                        This will permanently delete all users. This action cannot be undone.
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
              )}
            </CardTitle>
            <CardDescription>View, manage, and assign roles to users in the system.</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-2 pr-4">
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-3">
                        {getRoleIcon(user.role)}
                        <div>
                            <p className="font-semibold">{user.name} ({user.nuId})</p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                            <p className="text-sm text-muted-foreground">Team(s): {getTeamDisplay(user)}</p>
                            {user.subTeam && <p className="text-sm text-muted-foreground">Sub-team: {user.subTeam}</p>}
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              Position: {user.position} {positionMap.get(user.position) && <span>{positionMap.get(user.position)}</span>}
                            </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <RoleDialog user={user} onUpdate={() => setRefreshKey(k => k + 1)} />
                        
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={!canDeleteUser(user)}>
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
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center pt-10">No users found.</p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
