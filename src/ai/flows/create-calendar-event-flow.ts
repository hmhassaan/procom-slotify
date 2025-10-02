
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
import { collection, getDocs, query, where, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { User } from '@/app/types';
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { addMinutes } from 'date-fns';


const CreateCalendarEventInputSchema = z.object({
  meetingId: z.string(),
  title: z.string(),
  date: z.number(), // timestamp
  time: z.string(), // e.g., "9:00 AM", "1:30 PM", or "09:50-10:40"
  durationInMinutes: z.number(),
  organizerId: z.string(),
  attendeeIds: z.array(z.string()),
  location: z.string().optional(),
  externalAttendees: z.array(z.string()).optional(),
});
export type CreateCalendarEventInput = z.infer<typeof CreateCalendarEventInputSchema>;


export const createCalendarEventFlow = ai.defineFlow(
  {
    name: 'createCalendarEventFlow',
    inputSchema: CreateCalendarEventInputSchema,
    outputSchema: z.void(),
  },
  async ({ meetingId, title, date, time, durationInMinutes, organizerId, attendeeIds, location, externalAttendees }) => {
    console.log('Starting createCalendarEventFlow...');
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
      console.warn('Google OAuth credentials are not configured. Skipping calendar event creation.');
      return;
    }
    
    if (!date || isNaN(date)) {
        throw new Error(`Invalid date timestamp received: ${date}`);
    }

    const organizerDoc = await getDoc(doc(db, 'users', organizerId));
    if (!organizerDoc.exists() || !organizerDoc.data().googleRefreshToken) {
      console.log(`Organizer ${organizerId} has not connected their Google Calendar. Skipping event creation.`);
      return;
    }
    const organizer = organizerDoc.data() as User;
    console.log(`Organizer found: ${organizer.email}`);
    
    const allUserIdsToFetch = [...new Set([organizerId, ...attendeeIds])];
    
    let internalAttendeeEmails: { email: string }[] = [];
    if (allUserIdsToFetch.length > 0) {
        console.log(`Querying for ${allUserIdsToFetch.length} internal users...`);

        // Batch Firestore queries since 'in' operator has a limit of 30 in a single query.
        const userChunks = [];
        for (let i = 0; i < allUserIdsToFetch.length; i += 30) {
          userChunks.push(allUserIdsToFetch.slice(i, i + 30));
        }

        const allUsers: User[] = [];
        for (const chunk of userChunks) {
          const usersQuery = query(collection(db, 'users'), where('__name__', 'in', chunk));
          const usersSnapshot = await getDocs(usersQuery);
          usersSnapshot.forEach(d => {
            allUsers.push(d.data() as User);
          });
        }
        
        internalAttendeeEmails = allUsers
            .filter(u => u.email && u.id !== organizerId) // Exclude organizer from attendee list
            .map(u => ({ email: u.email! }));

        console.log(`Found ${internalAttendeeEmails.length} internal attendees with emails.`);
    }

    const externalAttendeeEmails = (externalAttendees || [])
        .map(email => email.trim())
        .filter(email => email)
        .map(email => ({ email }));
    
    console.log(`Found ${externalAttendeeEmails.length} external attendees.`);

    const allAttendeeEmails = [...internalAttendeeEmails, ...externalAttendeeEmails];
    
    const timeZone = 'Asia/Karachi';

    const parseTime = (timeStr: string): string | null => {
        timeStr = timeStr.trim();
        
        // Handle range format like "9:00-10:00" or "9:00 AM-10:00 AM"
        const rangeSplit = timeStr.split(/[-–]/);
        if (rangeSplit.length > 1) {
            timeStr = rangeSplit[0].trim();
        }
        
        // Check if it's 12-hour format (has AM/PM)
        if (timeStr.includes('AM') || timeStr.includes('PM') || timeStr.includes('am') || timeStr.includes('pm')) {
            const [timePart, modifier] = timeStr.split(/\s+/);
            if (!timePart || !modifier) return null;

            let [hours, minutes] = timePart.split(':').map(Number);
            if (isNaN(hours)) hours = 0;
            if (isNaN(minutes)) minutes = 0;

            if (hours === 12) {
                hours = modifier.toUpperCase() === 'AM' ? 0 : 12;
            } else {
                if (modifier.toUpperCase() === 'PM') {
                    hours += 12;
                }
            }
            
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        }
        
        // Handle 24-hour format like "09:50" or "9:50"
        const parts = timeStr.split(':');
        if (parts.length === 2) {
            const hours = parseInt(parts[0], 10);
            const minutes = parseInt(parts[1], 10);
            if (!isNaN(hours) && !isNaN(minutes) && hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
                 return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
            }
        }
        
        return null;
    };
    
    const [startTimeRaw, endTimeRaw] = time.split(/[-–]/);
    
    const startTimeStr = parseTime(startTimeRaw);
    const endTimeStr = endTimeRaw ? parseTime(endTimeRaw) : null;
    
    if (!startTimeStr) {
      throw new Error(`Invalid time format: "${time}"`);
    }

    const meetingDate = new Date(date);
    const ymd = formatInTimeZone(meetingDate, timeZone, 'yyyy-MM-dd');
    const startUtc = fromZonedTime(`${ymd} ${startTimeStr}:00`, timeZone);
    let endUtc;

    if (endTimeStr) {
        endUtc = fromZonedTime(`${ymd} ${endTimeStr}:00`, timeZone);
    } else {
        endUtc = addMinutes(startUtc, durationInMinutes);
    }


    if (isNaN(startUtc.getTime()) || isNaN(endUtc.getTime())) {
        throw new Error(`Failed to create valid date objects. Start: ${startUtc}, End: ${endUtc}`);
    }

    const event = {
      summary: title,
      location: location || undefined,
      start: { dateTime: startUtc.toISOString(), timeZone },
      end:   { dateTime: endUtc.toISOString(),   timeZone },
      attendees: allAttendeeEmails,
      organizer: { email: organizer.email },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 },
          { method: 'popup', minutes: 10 },
        ],
      },
    };

    console.log('Constructed event object:', JSON.stringify(event, null, 2));
    
    console.log(`Creating calendar event using organizer's (${organizer.email}) account...`);
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
    );
    oauth2Client.setCredentials({ refresh_token: organizer.googleRefreshToken });
    
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    try {
        const createdEvent = await calendar.events.insert({
            calendarId: 'primary',
            requestBody: event,
            sendUpdates: 'all',
        });
        console.log(`Successfully created calendar event for all attendees.`);

        if (createdEvent.data.iCalUID) {
          const googleIcalUid = createdEvent.data.iCalUID;
          console.log(`Captured iCalUID: ${googleIcalUid}`);
          console.log(`Updating meeting ${meetingId} with iCalUID...`);
          const meetingRef = doc(db, 'meetings', meetingId);
          await updateDoc(meetingRef, { googleIcalUid: googleIcalUid });
          console.log('Successfully updated meeting with iCalUID.');
        }

    } catch (error: any) {
        console.error(`Failed to create calendar event:`, error.message);
        throw new Error(`Failed to create Google Calendar event: ${error.message}`);
    }

    console.log('Finished createCalendarEventFlow.');
  }
);
