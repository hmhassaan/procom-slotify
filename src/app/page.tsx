"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, LogIn, LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function Home() {
  const { currentUser, signIn, signOut: firebaseSignOut } = useAuth();
  const router = useRouter();

  const handleSignIn = async () => {
    try {
      await signIn();
      router.push('/add-schedule');
    } catch (error) {
      console.error("Sign in failed", error);
    }
  };

  const handleSignOut = async () => {
    await firebaseSignOut();
    router.push('/');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background">
      <div className="text-center max-w-2xl mx-auto p-4">
        <h1 className="text-4xl md:text-5xl font-bold font-headline text-primary tracking-tight">
          Course Extractor
        </h1>
        <p className="text-muted-foreground mt-3">
          {currentUser ? `Welcome, ${currentUser.displayName}!` : "Please sign in to continue."}
        </p>
      </div>

      {currentUser ? (
        <>
          <nav className="mt-8">
            <ul className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <li>
                <Link href="/add-schedule" passHref>
                  <Button className="w-full text-lg py-6 px-8" variant="outline">
                    Add Your Schedule <ArrowRight className="ml-2" />
                  </Button>
                </Link>
              </li>
              <li>
                <Link href="/admin" passHref>
                  <Button className="w-full text-lg py-6 px-8" variant="outline">
                    Admin Panel <ArrowRight className="ml-2" />
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
            </ul>
          </nav>
          <div className="mt-8">
            <Button onClick={handleSignOut} className="text-lg py-6 px-8">
              <LogOut className="mr-2" /> Sign Out
            </Button>
          </div>
        </>
      ) : (
        <div className="mt-8">
          <Button onClick={handleSignIn} className="text-lg py-6 px-8">
            <LogIn className="mr-2" /> Sign In with Google
          </Button>
        </div>
      )}
    </div>
  );
}
