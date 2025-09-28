
'use server';
/**
 * @fileOverview A flow for notifying all users about a schedule update.
 *
 * - notifyAllUsersOnScheduleUpdateFlow - The main flow to trigger notifications.
 * - ScheduleUpdatePayload - The input type for the flow.
 */
import '@/lib/firebaseAdmin';
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getFirestore } from 'firebase-admin/firestore';
import { notifyUserFlow } from './notify-flow';
import type { User } from '@/app/types';

const SlotCoursesIndexSchema = z.record(z.string(), z.record(z.string(), z.array(z.string())));

const ScheduleUpdatePayloadSchema = z.object({
  newCourses: z.array(z.string()).describe('The list of all new course names.'),
  slotCourses: SlotCoursesIndexSchema.describe('The new schedule structure.'),
  timeSlots: z.array(z.string()).describe('The list of new time slots.'),
});
export type ScheduleUpdatePayload = z.infer<typeof ScheduleUpdatePayloadSchema>;

const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const isLab = (name: string) => /\blab\b/i.test(name);

export const notifyAllUsersOnScheduleUpdateFlow = ai.defineFlow(
  {
    name: 'notifyAllUsersOnScheduleUpdateFlow',
    inputSchema: ScheduleUpdatePayloadSchema,
    outputSchema: z.void(),
  },
  async (payload) => {
    const firestore = getFirestore();
    const usersSnapshot = await firestore.collection('users').get();
    
    if (usersSnapshot.empty) {
      console.log('No users found to notify.');
      return;
    }

    const notificationPromises: Promise<any>[] = [];

    for (const userDoc of usersSnapshot.docs) {
      const user = userDoc.data() as User;

      // Calculate unavailable slots for this user based on the new schedule
      let unavailableSlotsCount = 0;
      const userCourses = user.courses.filter(c => payload.newCourses.includes(c));

      weekdays.forEach(day => {
        if (!user.offDays.includes(day)) {
          const busySlotsThisDay = new Set<string>();
          const daySchedule = payload.slotCourses[day] || {};

          // Iterate through timeslots to identify all busy periods
          for (let i = 0; i < payload.timeSlots.length; i++) {
            const time = payload.timeSlots[i];
            
            // Skip if already marked as busy by a preceding lab
            if (busySlotsThisDay.has(time)) continue;

            const coursesInSlot = daySchedule[time] || [];
            const userCoursesInSlot = userCourses.filter(c => coursesInSlot.includes(c));

            if (userCoursesInSlot.length > 0) {
              const hasLab = userCoursesInSlot.some(isLab);
              if (hasLab) {
                // For a lab, block this slot and the next 2
                for (let j = i; j < Math.min(i + 3, payload.timeSlots.length); j++) {
                  busySlotsThisDay.add(payload.timeSlots[j]);
                }
              } else {
                // For a regular class, block just this slot
                busySlotsThisDay.add(time);
              }
            }
          }
          unavailableSlotsCount += busySlotsThisDay.size;
        }
      });
      
      const newCoursesMessage = `The new schedule includes ${payload.newCourses.length} courses.`;
      const unavailableMessage = `Based on your selected courses, you now have ${unavailableSlotsCount} unavailable slots.`;

      // Define the notification payload for this user
      const notificationPayload = {
        userId: user.id,
        title: 'Timetable Has Been Updated!',
        message: `${newCoursesMessage} ${unavailableMessage} Please review your schedule.`,
        link: '/view-schedule',
      };
      
      // Add the promise to the list
      notificationPromises.push(notifyUserFlow.run(notificationPayload));
    }

    // Wait for all notifications to be sent
    try {
      await Promise.all(notificationPromises);
      console.log(`Successfully queued notifications for ${usersSnapshot.size} users.`);
    } catch (error) {
      console.error('An error occurred while sending notifications:', error);
    }
  }
);
