
'use server';
/**
 * @fileOverview A flow for deleting Google Calendar events for meetings.
 *
 * - deleteCalendarEventFlow - The main flow to delete the event.
 * - DeleteCalendarEventInput - The input type for the flow.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { google } from 'googleapis';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { User } from '@/app/types';

const DeleteCalendarEventInputSchema = z.object({
  attendeeIds: z.array(z.string()),
  googleIcalUid: z.string(),
});
export type DeleteCalendarEventInput = z.infer<typeof DeleteCalendarEventInputSchema>;

export const deleteCalendarEventFlow = ai.defineFlow(
  {
    name: 'deleteCalendarEventFlow',
    inputSchema: DeleteCalendarEventInputSchema,
    outputSchema: z.void(),
  },
  async ({ attendeeIds, googleIcalUid }) => {
    console.log(`Starting deleteCalendarEventFlow for iCalUID: ${googleIcalUid}`);
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
      console.warn('Google OAuth credentials are not configured. Skipping calendar event deletion.');
      return;
    }
    
    if (attendeeIds.length === 0) {
        console.log('No attendees found. Skipping calendar event deletion.');
        return;
    }

    console.log(`Querying for ${attendeeIds.length} users...`);
    const usersQuery = query(collection(db, 'users'), where('__name__', 'in', attendeeIds));
    const usersSnapshot = await getDocs(usersQuery);
    const usersWithTokens: { user: User; email: string }[] = [];
    
    usersSnapshot.forEach(doc => {
      const user = doc.data() as User;
      if (user.googleRefreshToken && user.email) {
        usersWithTokens.push({ user, email: user.email });
      }
    });

    if (usersWithTokens.length === 0) {
      console.log('No attendees have connected their Google Calendar. Skipping event deletion.');
      return;
    }
    console.log(`Found ${usersWithTokens.length} users with Google Calendar tokens to process for deletion.`);

    for (const { user } of usersWithTokens) {
        console.log(`Processing calendar event deletion for ${user.email}...`);
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );
        oauth2Client.setCredentials({ refresh_token: user.googleRefreshToken });
        
        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
        
        try {
            // First, find the event ID on this user's calendar using the iCalUID
            const eventList = await calendar.events.list({
                calendarId: 'primary',
                iCalUID: googleIcalUid,
            });

            if (eventList.data.items && eventList.data.items.length > 0) {
                const eventId = eventList.data.items[0].id;
                if (eventId) {
                    console.log(`Found event ${eventId} for user ${user.email}. Deleting...`);
                    // Now delete the event by its specific ID
                    await calendar.events.delete({
                        calendarId: 'primary',
                        eventId: eventId,
                        sendUpdates: 'all',
                    });
                    console.log(`Successfully deleted calendar event for ${user.email}`);
                } else {
                     console.log(`Event found for ${user.email} but it has no ID.`);
                }
            } else {
                console.log(`No event with iCalUID ${googleIcalUid} found on calendar for ${user.email}. Skipping.`);
            }
        } catch (error: any) {
            console.error(`Failed to delete calendar event for ${user.email}:`, error.message);
        }
    }
    console.log('Finished deleteCalendarEventFlow.');
  }
);
