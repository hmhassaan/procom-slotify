
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from './use-toast';

// This function converts the VAPID public key to a Uint8Array
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const subscribe = useCallback(async () => {
    if (!currentUser || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
        console.error("VAPID public key or user not available.");
        return;
    }

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn("Push notifications are not supported by this browser.");
        return;
    }

    try {
        const registration = await navigator.serviceWorker.ready;
        let sub = await registration.pushManager.getSubscription();

        if (sub === null) {
            console.log("No existing subscription found, creating new one.");
            const applicationServerKey = urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
            sub = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey,
            });
        } else {
            console.log("Existing subscription found.");
        }

        console.log('User is subscribed:', sub);
        
        // Convert subscription to a plain object before storing
        const subscriptionObject = sub.toJSON();

        const userDocRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userDocRef, {
            pushSubscription: subscriptionObject,
        });

        setIsSubscribed(true);
        setSubscription(sub);
        setError(null);
        toast({
            title: "Notifications Enabled",
            description: "You will now receive push notifications.",
        });

    } catch (e: any) {
        console.error('Failed to subscribe the user: ', e);
        setError(e);
        toast({
            variant: "destructive",
            title: "Subscription Failed",
            description: "Could not enable push notifications. Please ensure you have granted permission.",
        });
    }
  }, [currentUser, toast]);

  const unsubscribe = useCallback(async () => {
    if (!currentUser) return;
     if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn("Push notifications are not supported by this browser.");
        return;
    }

    try {
        const registration = await navigator.serviceWorker.ready;
        const sub = await registration.pushManager.getSubscription();
        
        if (sub) {
            await sub.unsubscribe();
            console.log("User unsubscribed.");
        }

        // Remove subscription from Firestore by setting it to null
        const userDocRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userDocRef, {
            pushSubscription: null,
        });


        setIsSubscribed(false);
        setSubscription(null);
        toast({
            title: "Notifications Disabled",
            description: "You will no longer receive push notifications.",
        });

    } catch (e: any) {
        console.error("Failed to unsubscribe user: ", e);
        toast({
            variant: "destructive",
            title: "Unsubscription Failed",
            description: "Could not disable push notifications.",
        });
    }
  }, [currentUser, toast]);


  useEffect(() => {
    async function checkSubscription() {
      if ('serviceWorker' in navigator && currentUser) {
        try {
            const registration = await navigator.serviceWorker.ready;
            const sub = await registration.pushManager.getSubscription();
            if (sub) {
                // Also verify against Firestore
                const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
                if (userDoc.exists() && userDoc.data().pushSubscription) {
                    setIsSubscribed(true);
                    setSubscription(sub);
                } else {
                    // Mismatch, so unsubscribe from push service
                    await sub.unsubscribe();
                    setIsSubscribed(false);
                    setSubscription(null);
                }
            } else {
                 setIsSubscribed(false);
                 setSubscription(null);
            }
        } catch (e) {
            console.error("Error checking for push subscription:", e);
        }
      }
    }
    checkSubscription();
  }, [currentUser]);


  // This function will be called by a UI element (e.g., a button)
  const requestSubscription = async () => {
    const permission = await window.Notification.requestPermission();
    if (permission === 'granted') {
      await subscribe();
    } else {
       toast({
            variant: "destructive",
            title: "Permission Denied",
            description: "You have denied permission for push notifications.",
       });
    }
  };

  return { isSubscribed, requestSubscription, unsubscribe, error };
}
