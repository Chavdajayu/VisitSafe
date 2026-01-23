import { useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth.jsx';
import { getMessaging, onMessage, isSupported } from 'firebase/messaging';
import { app } from '@/lib/firebase';
import { requestToken } from '@/lib/firebase-messaging';

export function NotificationManager() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const initializeNotifications = async () => {
      try {
        const supported = await isSupported();
        if (!supported) return;

        // SW Registration is handled in main.jsx to ensure single registration with correct localized config

        // Request Token & Save to DB (replaces old token)
        if (user.username && user.residencyId) {
          await requestToken(user.username, user.role, user.residencyId);
        }

        // Foreground Message Handler
        const messaging = getMessaging(app);
        onMessage(messaging, (payload) => {
          console.log("Foreground Message:", payload);
          const { title, body, icon } = payload.notification || {};
          const data = payload.data || {};

          // Allow system notification even in foreground for consistent experience
          // Use 'tag' to prevent duplication if edge case occurs
          if (Notification.permission === 'granted') {
            new Notification(title || 'VisitSafe', {
              body: body,
              icon: icon || '/icons/icon-192.png',
              tag: data.tag || data.visitorId || 'default', // Critical for dedupe
              data: data,
              requireInteraction: true // consistent with background
            });
          }
        });

      } catch (error) {
        console.error('Error initializing notifications:', error);
      }
    };

    initializeNotifications();
  }, [user]);

  return null;
}