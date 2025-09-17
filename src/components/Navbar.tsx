
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LogOut, Home, CalendarPlus, CalendarCheck, Shield, Menu } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useState } from "react";
import { Separator } from "@/components/ui/separator";

export default function Navbar() {
  const { currentUser, currentUserProfile, hasAdminPrivileges, signOut: firebaseSignOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await firebaseSignOut();
    router.push('/login');
  };

  if (!currentUser || pathname === '/login') {
    return null;
  }
  
  const navItems = [
    { href: "/", label: "Home", icon: Home },
    { href: "/add-schedule", label: "My Schedule", icon: CalendarPlus },
    { href: "/view-schedule", label: "View Schedule", icon: CalendarCheck },
  ];

  if (hasAdminPrivileges) {
    navItems.push({ href: "/admin", label: "Admin", icon: Shield });
  }

  const NavLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
    <Link
      href={href}
      className={cn(
        "transition-colors hover:text-foreground/80",
        pathname === href ? "text-foreground" : "text-foreground/60"
      )}
      onClick={() => setIsMobileMenuOpen(false)}
    >
      {children}
    </Link>
  );

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur-sm">
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex items-center">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <span className="font-bold">Procom Schedule Manager</span>
          </Link>
          <nav className="hidden md:flex items-center space-x-6 text-sm font-medium">
            {navItems.map(item => (
                 <NavLink key={item.label} href={item.href}>
                    {item.label}
                </NavLink>
            ))}
          </nav>
        </div>
        
        {/* Desktop Nav Actions */}
        <div className="hidden flex-1 items-center justify-end space-x-4 md:flex">
            <span className="text-sm text-muted-foreground">
              {currentUser.displayName}
            </span>
           <Button onClick={handleSignOut} size="sm">
              <LogOut className="mr-2 h-4 w-4" /> Sign Out
            </Button>
        </div>

        {/* Mobile Nav Trigger */}
        <div className="flex flex-1 justify-end md:hidden">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetTrigger asChild>
                    <Button variant="ghost" size="icon">
                        <Menu />
                        <span className="sr-only">Open Menu</span>
                    </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-full max-w-xs">
                    <SheetHeader>
                        <SheetTitle>Menu</SheetTitle>
                    </SheetHeader>
                    <div className="mt-4 flex h-full flex-col">
                        <nav className="flex flex-col gap-6 text-lg font-medium">
                             {navItems.map(item => (
                                <NavLink key={item.label} href={item.href}>
                                    <div className="flex items-center gap-3">
                                        <item.icon className="h-5 w-5" />
                                        {item.label}
                                    </div>
                                </NavLink>
                            ))}
                        </nav>
                        <Separator className="my-6" />
                        <div className="flex flex-col gap-4">
                             <div className="text-sm text-muted-foreground">
                                Signed in as {currentUser.displayName}
                             </div>
                             <Button onClick={handleSignOut} size="sm">
                                <LogOut className="mr-2 h-4 w-4" /> Sign Out
                             </Button>
                        </div>
                    </div>
                </SheetContent>
            </Sheet>
        </div>
      </div>
    </header>
  );
}

    