
"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { doc, setDoc, getDoc, deleteDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "./use-toast";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

async function getVapidKey(): Promise<string> {
  let res: Response;
  try {
    res = await fetch("/api/getVapidPublicKey", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown network error";
    console.error("Network error while fetching VAPID public key:", msg);
    throw new Error(`Network error: ${msg}`);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "Could not read response body");
    console.error(`VAPID endpoint failed (${res.status}): ${text}`);
    throw new Error(`Server error (${res.status}) while fetching VAPID key.`);
  }

  let data: any;
  try {
    data = await res.json();
  } catch {
    console.error("Invalid JSON returned from VAPID endpoint.");
    throw new Error("Invalid response from server.");
  }

  if (!data || typeof data.result !== "string" || !data.result.length) {
    console.error("VAPID public key missing in response from server.");
    throw new Error("VAPID key not found in server response.");
  }

  return data.result;
}

export function usePushNotifications() {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const getSubscriptionId = (sub: PushSubscription) => {
      const endpointHash = btoa(sub.endpoint).replace(/=/g, '').replace(/\//g, '_').replace(/\+/g, '-');
      return endpointHash;
  };

  const saveSubscription = useCallback(
    async (sub: PushSubscription) => {
      if (!currentUser) return;
      const json = sub.toJSON();
      const minimal = {
        endpoint: json.endpoint,
        keys: json.keys ?? {},
      };
      const subscriptionId = getSubscriptionId(sub);
      const subDocRef = doc(db, "users", currentUser.uid, "subscriptions", subscriptionId);
      await setDoc(subDocRef, minimal);
      console.log('Subscription saved to Firestore.');
    },
    [currentUser]
  );

  const subscribe = useCallback(async () => {
    if (!currentUser) {
      console.error("User not available for subscription.");
      return;
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      console.warn("Push notifications are not supported by this browser.");
      toast({
        variant: "destructive",
        title: "Unsupported",
        description: "Your browser does not support push notifications.",
      });
      return;
    }
    try {
      const registration = await navigator.serviceWorker.ready;
      console.log("Service worker is ready for push manager.");

      const vapidPublicKey = await getVapidKey();
      console.log("Fetched VAPID public key.");
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

      let sub = await registration.pushManager.getSubscription();
      if (!sub) {
        console.log("No existing subscription found, creating new one.");
        sub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
      } else {
        console.log("Existing subscription found.");
      }

      await saveSubscription(sub);
      setIsSubscribed(true);
      setSubscription(sub);
      setError(null);
      toast({
        title: "Notifications Enabled",
        description: "You will now receive push notifications on this device.",
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("Failed to subscribe the user: ", msg);
      setError(e as Error);
      toast({
        variant: "destructive",
        title: "Subscription Failed",
        description: msg || "Could not enable push notifications.",
      });
    }
  }, [currentUser, saveSubscription, toast]);

  const unsubscribe = useCallback(async () => {
    if (!currentUser || !subscription) return;
    try {
      await subscription.unsubscribe();
      console.log('Unsubscribed from push service.');

      const subscriptionId = getSubscriptionId(subscription);
      const subDocRef = doc(db, "users", currentUser.uid, "subscriptions", subscriptionId);
      await deleteDoc(subDocRef);
      console.log('Subscription removed from Firestore.');
      
      setIsSubscribed(false);
      setSubscription(null);
      toast({
        title: "Notifications Disabled",
        description: "You will no longer receive push notifications on this device.",
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("Failed to unsubscribe user: ", msg);
      toast({
        variant: "destructive",
        title: "Unsubscription Failed",
        description: msg || "Could not disable push notifications.",
      });
    }
  }, [currentUser, subscription, toast]);

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !currentUser) return;
      try {
        const registration = await navigator.serviceWorker.ready;
        const sub = await registration.pushManager.getSubscription();

        if (!sub) {
          setIsSubscribed(false);
          setSubscription(null);
          return;
        }

        const subscriptionId = getSubscriptionId(sub);
        const subDocRef = doc(db, "users", currentUser.uid, "subscriptions", subscriptionId);
        const docSnap = await getDoc(subDocRef);

        if (docSnap.exists()) {
           setIsSubscribed(true);
           setSubscription(sub);
        } else {
           await saveSubscription(sub);
           setIsSubscribed(true);
           setSubscription(sub);
        }
      } catch (e) {
        console.error("Error checking for push subscription:", e);
      }
    })();
  }, [currentUser, saveSubscription]);

  const requestSubscription = async () => {
    if (!("Notification" in window)) {
      toast({
        variant: "destructive",
        title: "Unsupported",
        description: "Notifications API is not available in this browser.",
      });
      return;
    }
    if (Notification.permission === "granted") {
      console.log("Notification permission already granted.");
      await subscribe();
      return;
    }
    if (Notification.permission === "denied") {
      toast({
        variant: "destructive",
        title: "Permission Denied",
        description: "Enable notifications in your browser settings to subscribe.",
      });
      return;
    }
    console.log("Requesting notification permission...");
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      console.log("Notification permission granted.");
      await subscribe();
    } else {
      console.log("Notification permission denied.");
      toast({
        variant: "destructive",
        title: "Permission Denied",
        description: "You denied permission for push notifications.",
      });
    }
  };

  return { isSubscribed, requestSubscription, unsubscribe, error, subscription };
}
