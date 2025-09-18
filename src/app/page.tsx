
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
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
      <div className="text-center max-w-2xl mx-auto p-4">
        <h1 className="text-4xl md:text-5xl font-bold font-headline text-primary tracking-tight">
          Welcome to Procom Schedule Manager
        </h1>
        <p className="text-muted-foreground mt-3">
          {`What would you like to do, ${name}?`}
        </p>
      </div>

      <nav className="mt-8">
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <li>
            <Link href="/add-schedule" passHref>
              <Button className="w-full text-lg py-6 px-8" variant="outline">
                My Schedule <ArrowRight className="ml-2" />
              </Button>
            </Link>
          </li>
          <li>
            <Link href="/view-schedule" passHref>
              <Button className="w-full text-lg py-6 px-8" variant="outline">
                View Schedule <ArrowRight className="ml-2" />
              </Button>
            </Link>
          </li>
          {hasAdminPrivileges && (
            <li className="md:col-span-2">
              <Link href="/admin" passHref>
                <Button className="w-full text-lg py-6 px-8" variant="outline">
                  Admin Panel <ArrowRight className="ml-2" />
                </Button>
              </Link>
            </li>
          )}
        </ul>
      </nav>
    </div>
  );
}
