
'use server';
/**
 * @fileOverview A flow for sending web push notifications to users.
 *
 * - notifyUserFlow - A flow that sends a push notification.
 * - NotificationPayload - The input type for the notifyUser function.
 * - getVapidPublicKeyFlow - A flow that returns the VAPID public key.
 */
import '@/lib/firebaseAdmin';
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

export const notifyUserFlow = ai.defineFlow(
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
    const subscriptionsCollection = firestore.collection('users').doc(payload.userId).collection('subscriptions');
    const subscriptionsSnapshot = await subscriptionsCollection.get();

    if (subscriptionsSnapshot.empty) {
      console.log(`User ${payload.userId} has no push subscriptions.`);
      return;
    }

    const notificationData = JSON.stringify({
      title: payload.title,
      body: payload.message,
      data: {
        url: payload.link || '/',
      },
    });

    const promises = subscriptionsSnapshot.docs.map(async (doc) => {
      const subscription = doc.data() as webpush.PushSubscription;
      try {
        await webpush.sendNotification(subscription, notificationData);
        console.log(`Push notification sent successfully to subscription ${doc.id} for user ${payload.userId}.`);
      } catch (error: any) {
        console.error(`Error sending push notification to subscription ${doc.id} for user ${payload.userId}:`, { status: error.statusCode, body: error.body, message: error.message });
        // If the subscription is expired or invalid (404 Not Found, 410 Gone), remove it.
        if (error.statusCode === 404 || error.statusCode === 410) {
          console.log(`Subscription ${doc.id} for user ${payload.userId} is invalid. Removing.`);
          await doc.ref.delete();
        }
      }
    });

    await Promise.all(promises);
  }
);


export const getVapidPublicKeyFlow = ai.defineFlow(
  {
    name: 'getVapidPublicKeyFlow',
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
