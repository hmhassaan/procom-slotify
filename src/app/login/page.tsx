
"use client";

import { Button } from "@/components/ui/button";
import { LogIn } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAppContext } from "@/context/AppContext";

export default function LoginPage() {
  const { currentUser, signIn, loading: authLoading } = useAuth();
  const { loading: appLoading } = useAppContext();
  const router = useRouter();
  const { toast } = useToast();

  const [clicking, setClicking] = useState(false);

  useEffect(() => {
    if (!authLoading && currentUser) {
      router.replace("/");
    }
  }, [currentUser, authLoading, router]);

  const handleSignIn = async () => {
    if (clicking) return;
    setClicking(true);
    try {
      await signIn(); 
    } catch (error: any) {
      const c = error?.code as string | undefined;
      if (
        c === "auth/popup-closed-by-user" ||
        c === "auth/popup-blocked" ||
        c === "auth/cancelled-popup-request"
      ) {
        return;
      }
      console.error("Sign in failed", error);
      toast({
        variant: "destructive",
        title: "Sign in failed",
        description: "Could not sign you in with Google. Please try again.",
      });
    } finally {
      setClicking(false);
    }
  };

  const loading = authLoading || appLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  if (currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Redirecting...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background">
      <div className="text-center max-w-2xl mx-auto p-4">
        <h1 className="text-4xl md:text-5xl font-bold font-headline text-primary tracking-tight">
          PROCOM Slotify
        </h1>
        <p className="text-muted-foreground mt-3">Please sign in to continue.</p>
      </div>

      <div className="mt-8 flex flex-col items-center space-y-4">
        <Button
          onClick={handleSignIn}
          className="text-lg py-6 px-8"
          disabled={loading || clicking}
        >
          <LogIn className="mr-2" />{" "}
          {clicking ? "Signing in…" : "Sign In with Google"}
        </Button>
      </div>
    </div>
  );
}
