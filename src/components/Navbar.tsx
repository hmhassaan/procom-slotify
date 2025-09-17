
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LogOut, Home, CalendarPlus, CalendarCheck, Shield } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

export default function Navbar() {
  const { currentUser, isAdmin, isTeamAdmin, isSubTeamAdmin, signOut: firebaseSignOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const handleSignOut = async () => {
    await firebaseSignOut();
    router.push('/login');
  };

  if (!currentUser || pathname === '/login') {
    return null;
  }
  
  const navItems = [
    { href: "/", label: "Home", icon: Home },
    { href: "/add-schedule", label: "Add Schedule", icon: CalendarPlus },
    { href: "/view-schedule", label: "View Schedule", icon: CalendarCheck },
  ];

  const hasAdminPrivileges = isAdmin || isTeamAdmin || isSubTeamAdmin;

  if (hasAdminPrivileges) {
    navItems.push({ href: "/admin", label: "Admin", icon: Shield });
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur-sm">
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex items-center">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <span className="font-bold">Procom Schedule Manager</span>
          </Link>
          <nav className="hidden md:flex items-center space-x-6 text-sm font-medium">
            {navItems.map(item => (
                 <Link
                    key={item.label}
                    href={item.href}
                    className={cn(
                      "transition-colors hover:text-foreground/80",
                      pathname === item.href ? "text-foreground" : "text-foreground/60"
                    )}
                 >
                    {item.label}
                </Link>
            ))}
          </nav>
        </div>
        <div className="flex flex-1 items-center justify-end space-x-4">
            <span className="hidden sm:inline-block text-sm text-muted-foreground">
              {currentUser.displayName}
            </span>
           <Button onClick={handleSignOut} size="sm">
              <LogOut className="mr-2 h-4 w-4" /> Sign Out
            </Button>
        </div>
      </div>
    </header>
  );
}
