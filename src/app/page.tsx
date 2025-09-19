
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, CalendarCheck, CalendarPlus, Shield } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAppContext } from "@/context/AppContext";

export default function Home() {
  const { currentUser, loading: authLoading } = useAuth();
  const { currentUserProfile, hasAdminPrivileges, loading: appLoading } = useAppContext();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push("/login");
    }
  }, [currentUser, authLoading, router]);

  const loading = authLoading || appLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  if (!currentUser) {
    return null; // or a redirect component
  }

  const name = currentUserProfile?.name || currentUser?.displayName || currentUser?.email || "there";

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background -mt-16">
       <div className="absolute inset-0 -z-10 h-full w-full bg-white bg-[linear-gradient(to_right,#f0f0f0_1px,transparent_1px),linear-gradient(to_bottom,#f0f0f0_1px,transparent_1px)] bg-[size:6rem_4rem] opacity-20"></div>

      <div className="text-center max-w-2xl mx-auto p-4">
        <h1 className="text-4xl md:text-5xl font-bold font-headline bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent tracking-tight pb-2">
          Welcome to PROCOM Slotify
        </h1>
        <p className="text-muted-foreground mt-3 text-lg">
          {`What would you like to do, ${name}?`}
        </p>
      </div>

      <nav className="mt-12">
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl">
          <li className={hasAdminPrivileges ? '' : 'md:col-start-1/2'}>
            <Link href="/add-schedule" passHref>
              <Button variant="outline" className="w-full text-lg h-28 flex-col gap-2 transition-transform duration-200 hover:scale-105 hover:shadow-xl">
                 <CalendarPlus className="w-8 h-8 text-primary" />
                My Schedule
              </Button>
            </Link>
          </li>
          <li>
            <Link href="/view-schedule" passHref>
               <Button variant="outline" className="w-full text-lg h-28 flex-col gap-2 transition-transform duration-200 hover:scale-105 hover:shadow-xl">
                 <CalendarCheck className="w-8 h-8 text-primary" />
                View Schedule
              </Button>
            </Link>
          </li>
          {hasAdminPrivileges && (
            <li className="md:col-span-2 lg:col-span-1">
              <Link href="/admin" passHref>
                 <Button variant="outline" className="w-full text-lg h-28 flex-col gap-2 transition-transform duration-200 hover:scale-105 hover:shadow-xl">
                   <Shield className="w-8 h-8 text-primary" />
                  Admin Panel
                </Button>
              </Link>
            </li>
          )}
        </ul>
      </nav>
    </div>
  );
}
