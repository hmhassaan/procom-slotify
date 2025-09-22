
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
  } catch {
    throw new Error("Network error while fetching VAPID public key.");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`VAPID endpoint failed (${res.status}): ${text || "no body"}`);
  }
  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new Error("Invalid JSON returned from VAPID endpoint.");
  }
  if (!data || typeof data.result !== "string" || !data.result.length) {
    throw new Error("VAPID public key missing in response.");
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
      // Use the endpoint as a unique identifier for the subscription document
      const endpointHash = btoa(sub.endpoint).replace(/=/g, '').replace(/\//g, '_').replace(/\+/g, '-');
      return endpointHash;
  };

  const saveSubscription = useCallback(
    async (sub: PushSubscription) => {
      if (!currentUser) return;
      const json = sub.toJSON();
      // Keep Firestore lean: endpoint + keys are enough server-side
      const minimal = {
        endpoint: json.endpoint,
        keys: json.keys ?? {},
      };
      const subscriptionId = getSubscriptionId(sub);
      const subDocRef = doc(db, "users", currentUser.uid, "subscriptions", subscriptionId);
      await setDoc(subDocRef, minimal);
    },
    [currentUser]
  );

  const subscribe = useCallback(async () => {
    if (!currentUser) {
      console.error("User not available.");
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

      const vapidPublicKey = await getVapidKey();
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

      let sub = await registration.pushManager.getSubscription();
      if (!sub) {
        sub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
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
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      console.warn("Push notifications are not supported by this browser.");
      return;
    }
    try {
      // Unsubscribe from the push service
      await subscription.unsubscribe();

      // Remove the subscription from Firestore
      const subscriptionId = getSubscriptionId(subscription);
      const subDocRef = doc(db, "users", currentUser.uid, "subscriptions", subscriptionId);
      await deleteDoc(subDocRef);
      
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

        // Check if this specific subscription exists in Firestore
        const subscriptionId = getSubscriptionId(sub);
        const subDocRef = doc(db, "users", currentUser.uid, "subscriptions", subscriptionId);
        const docSnap = await getDoc(subDocRef);

        if (docSnap.exists()) {
           setIsSubscribed(true);
           setSubscription(sub);
        } else {
           // The browser has a subscription, but we don't have it in Firestore.
           // This can happen if the user cleared site data on the server but not the browser.
           // Let's sync it.
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
        description: "Notifications API is not available in this environment.",
      });
      return;
    }
    if (Notification.permission === "granted") {
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
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      await subscribe();
    } else {
      toast({
        variant: "destructive",
        title: "Permission Denied",
        description: "You denied permission for push notifications.",
      });
    }
  };

  return { isSubscribed, requestSubscription, unsubscribe, error, subscription };
}
