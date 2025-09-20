
'use server';
/**
 * @fileOverview A flow for sending web push notifications to users.
 *
 * - notifyUser - A function that sends a push notification.
 * - NotificationPayload - The input type for the notifyUser function.
 * - getVapidPublicKey - A function that returns the VAPID public key.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import * as webpush from 'web-push';
import {getFirestore} from 'firebase-admin/firestore';

const NotificationPayloadSchema = z.object({
  userId: z.string().describe('The ID of the user to notify.'),
  title: z.string().describe('The title of the notification.'),
  message: z.string().describe('The body content of the notification.'),
  link: z.string().optional().describe('A URL to open when the notification is clicked.'),
});
export type NotificationPayload = z.infer<typeof NotificationPayloadSchema>;

export async function notifyUser(payload: NotificationPayload): Promise<void> {
  return notifyUserFlow(payload);
}

const notifyUserFlow = ai.defineFlow(
  {
    name: 'notifyUserFlow',
    inputSchema: NotificationPayloadSchema,
    outputSchema: z.void(),
  },
  async (payload) => {
    // Configure web-push with VAPID details inside the flow
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_MAILTO) {
        webpush.setVapidDetails(
            `mailto:${process.env.VAPID_MAILTO}`,
            process.env.VAPID_PUBLIC_KEY,
            process.env.VAPID_PRIVATE_KEY
        );
    } else {
        console.warn("VAPID keys not configured. Push notifications will not work.");
        return; // Exit if not configured
    }

    const firestore = getFirestore();
    const userDocRef = firestore.collection('users').doc(payload.userId);
    const userDoc = await userDocRef.get();

    if (!userDoc.exists) {
      console.error(`User with ID ${payload.userId} not found.`);
      return;
    }

    const userData = userDoc.data();
    if (!userData || !userData.pushSubscription) {
      console.log(`User ${payload.userId} does not have a push subscription.`);
      return;
    }

    const subscription = userData.pushSubscription as webpush.PushSubscription;
    const notificationData = JSON.stringify({
      title: payload.title,
      body: payload.message,
      data: {
        url: payload.link || '/',
      },
    });

    try {
      await webpush.sendNotification(subscription, notificationData);
      console.log(`Push notification sent successfully to user ${payload.userId}.`);
    } catch (error: any) {
      console.error(`Error sending push notification to user ${payload.userId}:`, error.body);
      // If the subscription is expired or invalid, remove it from the user's document
      if (error.statusCode === 404 || error.statusCode === 410) {
        console.log(`Subscription for user ${payload.userId} is invalid. Removing.`);
        await userDocRef.update({ pushSubscription: null });
      }
    }
  }
);


export const getVapidPublicKey = ai.defineFlow(
  {
    name: 'getVapidPublicKey',
    inputSchema: z.void(),
    outputSchema: z.string(),
  },
  async () => {
    if (!process.env.VAPID_PUBLIC_KEY) {
      throw new Error('VAPID_PUBLIC_KEY is not defined on the server.');
    }
    return process.env.VAPID_PUBLIC_KEY;
  }
);
