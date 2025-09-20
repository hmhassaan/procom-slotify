
/*
import { onDocumentCreated } from '@genkit-ai/firebase/functions';
import { notifyUser } from './flows/notify-flow';
import type { Notification } from '@/app/types';

export const onNotificationCreated = onDocumentCreated(
  'notifications/{notificationId}',
  async (event) => {
    const notification = event.data?.data() as Notification;
    if (!notification) {
      console.error('Notification data is missing from the event.');
      return;
    }

    await notifyUser({
      userId: notification.userId,
      title: notification.title,
      message: notification.message,
      link: notification.link,
    });
  }
);
*/
