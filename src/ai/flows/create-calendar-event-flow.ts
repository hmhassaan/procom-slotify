
'use server';
/**
 * @fileOverview A flow for creating Google Calendar events for meetings.
 *
 * - createCalendarEventFlow - The main flow to create the event.
 * - CreateCalendarEventInput - The input type for the flow.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { google } from 'googleapis';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { User } from '@/app/types';

const CreateCalendarEventInputSchema = z.object({
  meetingId: z.string(),
  title: z.string(),
  date: z.number(), // timestamp
  time: z.string(), // e.g., "9:00 AM - 9:30 AM"
  attendeeIds: z.array(z.string()),
});
export type CreateCalendarEventInput = z.infer<typeof CreateCalendarEventInputSchema>;

const timeTo24Hour = (time: string): { hours: number; minutes: number } => {
  const match = time.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) {
    throw new Error(`Invalid time format provided to timeTo24Hour: "${time}". Expected format like "9:00 AM".`);
  }
  const [hourStr, minuteStr, ampm] = match.slice(1);
  let hours = parseInt(hourStr, 10);
  if (ampm.toUpperCase() === 'PM' && hours < 12) {
    hours += 12;
  }
  if (ampm.toUpperCase() === 'AM' && hours === 12) {
    hours = 0;
  }
  return { hours, minutes: parseInt(minuteStr, 10) };
};


export const createCalendarEventFlow = ai.defineFlow(
  {
    name: 'createCalendarEventFlow',
    inputSchema: CreateCalendarEventInputSchema,
    outputSchema: z.void(),
  },
  async ({ title, date, time, attendeeIds }) => {
    console.log('Starting createCalendarEventFlow...');
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
      console.warn('Google OAuth credentials are not configured. Skipping calendar event creation.');
      return;
    }
    
    if (attendeeIds.length === 0) {
        console.log('No attendees to invite. Skipping calendar event creation.');
        return;
    }

    console.log(`Querying for ${attendeeIds.length} users...`);
    const usersQuery = query(collection(db, 'users'), where('__name__', 'in', attendeeIds));
    const usersSnapshot = await getDocs(usersQuery);
    const usersWithTokens: { user: User, email: string }[] = [];
    
    usersSnapshot.forEach(doc => {
      const user = doc.data() as User;
      if (user.googleRefreshToken && user.email) {
        usersWithTokens.push({ user, email: user.email });
      }
    });

    if (usersWithTokens.length === 0) {
      console.log('No attendees have connected their Google Calendar. Skipping event creation.');
      return;
    }
    console.log(`Found ${usersWithTokens.length} users with Google Calendar tokens.`);
    
    const [startTimeStr] = time.split(' - ');
    const meetingDate = new Date(date);
    const { hours, minutes } = timeTo24Hour(startTimeStr);
    
    const eventStartTime = new Date(meetingDate);
    eventStartTime.setHours(hours, minutes, 0, 0);

    const eventEndTime = new Date(eventStartTime.getTime() + 30 * 60 * 1000); // Assume 30 min duration

    const event = {
      summary: title,
      start: {
        dateTime: eventStartTime.toISOString(),
        timeZone: 'Asia/Karachi', // You might want to make this configurable
      },
      end: {
        dateTime: eventEndTime.toISOString(),
        timeZone: 'Asia/Karachi',
      },
      attendees: usersWithTokens.map(u => ({ email: u.email })),
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 },
          { method: 'popup', minutes: 10 },
        ],
      },
    };

    console.log('Constructed event object:', event);

    for (const { user } of usersWithTokens) {
        console.log(`Processing calendar event for ${user.email}...`);
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );
        oauth2Client.setCredentials({ refresh_token: user.googleRefreshToken });
        
        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
        
        try {
            await calendar.events.insert({
                calendarId: 'primary',
                requestBody: event,
                sendNotifications: true,
            });
            console.log(`Successfully created calendar event for ${user.email}`);
        } catch (error: any) {
            console.error(`Failed to create calendar event for ${user.email}:`, error.message);
            // This might happen if the token is revoked. We should handle this gracefully.
        }
    }
    console.log('Finished createCalendarEventFlow.');
  }
);
