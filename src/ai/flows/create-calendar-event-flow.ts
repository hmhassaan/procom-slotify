
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
import { collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { User } from '@/app/types';
import { fromZonedTime, format as tzFormat } from 'date-fns-tz';
import { addMinutes } from 'date-fns';


const CreateCalendarEventInputSchema = z.object({
  meetingId: z.string(),
  title: z.string(),
  date: z.number(), // timestamp
  time: z.string(), // e.g., "9:00-9:50"
  attendeeIds: z.array(z.string()),
});
export type CreateCalendarEventInput = z.infer<typeof CreateCalendarEventInputSchema>;


export const createCalendarEventFlow = ai.defineFlow(
  {
    name: 'createCalendarEventFlow',
    inputSchema: CreateCalendarEventInputSchema,
    outputSchema: z.void(),
  },
  async ({ meetingId, title, date, time, attendeeIds }) => {
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
    const [startTimeStrRaw, endTimeStrRaw] = time.split(/[-–]/);
    if (!startTimeStrRaw) {
      throw new Error(`Invalid time range format: "${time}"`);
    }

    const startTimeStr = startTimeStrRaw.trim();
    const endTimeStr = endTimeStrRaw?.trim();

    const meetingDate = new Date(date); // timestamp (ms)
    const ymd = tzFormat(meetingDate, 'yyyy-MM-dd', { timeZone });

    // Build local PKT wall times, then convert to UTC instants
    const startUtc = fromZonedTime(`${ymd}T${startTimeStr}:00`, timeZone);
    
    let endUtc;
    if (endTimeStr) {
        endUtc = fromZonedTime(`${ymd}T${endTimeStr}:00`, timeZone);
    } else {
        endUtc = addMinutes(startUtc, 50);
    }

    if (isNaN(startUtc.getTime()) || isNaN(endUtc.getTime())) {
        throw new Error(`Failed to create valid date objects. Start: ${startUtc}, End: ${endUtc}`);
    }

    const event = {
      summary: title,
      start: { dateTime: startUtc.toISOString(), timeZone },
      end:   { dateTime: endUtc.toISOString(),   timeZone },
      attendees: usersWithTokens.map(u => ({ email: u.email })),
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 },
          { method: 'popup', minutes: 10 },
        ],
      },
    };

    console.log('Constructed event object:', JSON.stringify(event, null, 2));
    
    let googleIcalUid: string | undefined = undefined;

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
            const createdEvent = await calendar.events.insert({
                calendarId: 'primary',
                requestBody: event,
                sendUpdates: 'all',
            });
            console.log(`Successfully created calendar event for ${user.email}`);

            if (!googleIcalUid && createdEvent.data.iCalUID) {
              googleIcalUid = createdEvent.data.iCalUID;
              console.log(`Captured iCalUID: ${googleIcalUid}`);
            }

        } catch (error: any) {
            console.error(`Failed to create calendar event for ${user.email}:`, error.message);
        }
    }

    if (googleIcalUid) {
      console.log(`Updating meeting ${meetingId} with iCalUID...`);
      const meetingRef = doc(db, 'meetings', meetingId);
      await updateDoc(meetingRef, { googleIcalUid: googleIcalUid });
      console.log('Successfully updated meeting with iCalUID.');
    }

    console.log('Finished createCalendarEventFlow.');
  }
);
