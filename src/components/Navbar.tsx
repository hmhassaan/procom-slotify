
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LogOut, Home, CalendarPlus, CalendarCheck, Shield, Menu, Bell, Info, BellRing, BellOff, CalendarHeart } from "lucide-react";
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
import { useAppContext } from "@/context/AppContext";
import { Logo } from "./Logo";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "./ui/scroll-area";
import { formatDistanceToNow } from 'date-fns';

export default function Navbar() {
  const { currentUser, signOut: firebaseSignOut } = useAuth();
  const { hasAdminPrivileges, notifications, markNotificationsAsRead, requestPushSubscription, isPushSubscribed, disablePushNotifications } = useAppContext();
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
    { href: "/meetings", label: "My Meetings", icon: CalendarHeart },
  ];

  if (hasAdminPrivileges) {
    navItems.push({ href: "/admin", label: "Admin", icon: Shield });
  }
  
  const hasUnreadNotifications = notifications.some(n => !n.isRead);

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

  const NotificationBell = () => (
     <Popover onOpenChange={(open) => open && markNotificationsAsRead()}>
        <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            {hasUnreadNotifications && (
            <span className="absolute top-1 right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            )}
        </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0">
            <div className="p-4 border-b flex justify-between items-center">
            <h4 className="font-medium text-sm">Notifications</h4>
            {isPushSubscribed ? (
                <Button size="sm" variant="ghost" onClick={disablePushNotifications} className="gap-2 text-destructive">
                    <BellOff /> Disable Push
                </Button>
            ) : (
                <Button size="sm" variant="ghost" onClick={requestPushSubscription} className="gap-2">
                    <BellRing /> Enable Push
                </Button>
            )}
            </div>
            <ScrollArea className="h-[300px]">
                {notifications.length > 0 ? (
                    notifications.map(n => (
                        <div key={n.id} className="p-4 border-b text-sm">
                        <p className="font-semibold">{n.title}</p>
                        <p className="text-muted-foreground mt-1">{n.message}</p>
                        <p className="text-xs text-muted-foreground/80 mt-2">
                            {formatDistanceToNow(n.createdAt, { addSuffix: true })}
                        </p>
                        </div>
                    ))
                ) : (
                    <div className="text-center text-sm text-muted-foreground p-10">
                    <Info className="mx-auto h-6 w-6 mb-2" />
                    You have no notifications.
                    </div>
                )}
            </ScrollArea>
        </PopoverContent>
    </Popover>
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur-sm">
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex items-center">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <Logo />
            <span className="font-bold">PROCOM Slotify</span>
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
            <NotificationBell />
            <span className="text-sm text-muted-foreground">
              {currentUser.displayName}
            </span>
           <Button onClick={handleSignOut} size="sm">
              <LogOut className="mr-2 h-4 w-4" /> Sign Out
            </Button>
        </div>

        {/* Mobile Nav Trigger */}
        <div className="flex flex-1 justify-end items-center gap-2 md:hidden">
            <NotificationBell />
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
