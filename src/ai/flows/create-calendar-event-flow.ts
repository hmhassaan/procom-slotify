
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
import {toZonedTime} from 'date-fns-tz';

const CreateCalendarEventInputSchema = z.object({
  meetingId: z.string(),
  title: z.string(),
  date: z.number(), // timestamp
  time: z.string(), // e.g., "9:00-9:50"
  attendeeIds: z.array(z.string()),
});
export type CreateCalendarEventInput = z.infer<typeof CreateCalendarEventInputSchema>;


const parseTime = (timeStr: string): { hours: number, minutes: number } => {
  const [hourStr, minuteStr] = timeStr.split(':');
  if (!hourStr || !minuteStr) {
    throw new Error(`Invalid time part format: "${timeStr}". Expected HH:MM.`);
  }
  const hours = parseInt(hourStr, 10);
  const minutes = parseInt(minuteStr, 10);
  if (isNaN(hours) || isNaN(minutes)) {
    throw new Error(`Could not parse time part: "${timeStr}".`);
  }
  return { hours, minutes };
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
    
    const timeZone = 'Asia/Karachi';
    const [startTimeStr, endTimeStr] = time.split(/[-–]/); // Handle both hyphen and en-dash
    
    if (!startTimeStr) {
        throw new Error(`Invalid time range format: "${time}"`);
    }

    const meetingDate = new Date(date);
    const start = parseTime(startTimeStr);
    
    // Create zoned date objects to ensure time is interpreted correctly in PKT
    const zonedMeetingDate = toZonedTime(meetingDate, timeZone);
    
    const eventStartTime = new Date(zonedMeetingDate);
    eventStartTime.setHours(start.hours, start.minutes, 0, 0);

    let eventEndTime;
    if (endTimeStr) {
        const end = parseTime(endTimeStr);
        eventEndTime = new Date(zonedMeetingDate);
        eventEndTime.setHours(end.hours, end.minutes, 0, 0);
        // Handle overnight meetings if necessary, though unlikely for this app
        if (eventEndTime <= eventStartTime) {
            eventEndTime.setDate(eventEndTime.getDate() + 1);
        }
    } else {
        // Fallback: assume 50 minute duration if no end time
        eventEndTime = new Date(eventStartTime.getTime() + 50 * 60 * 1000);
    }
    

    const event = {
      summary: title,
      start: {
        dateTime: eventStartTime.toISOString(),
        timeZone: timeZone,
      },
      end: {
        dateTime: eventEndTime.toISOString(),
        timeZone: timeZone,
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
