// ─── Push Notifications Hook ────────────────────────────────
// Handles permission requests, device token retrieval, and
// backend token sync for Firebase Cloud Messaging.
//
// Usage:
//   const { registerForPushNotifications, unregisterPushToken } = usePushNotifications();
//   // Call registerForPushNotifications() after login
//   // Call unregisterPushToken() before logout

import { useCallback, useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from '../services/api';

// ─── Foreground notification presentation ────────────────────
// Show notifications even when the app is in the foreground.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ─── Hook ────────────────────────────────────────────────────

export function usePushNotifications() {
  const tokenRef = useRef<string | null>(null);

  // ─── Register for push notifications ─────────────────────
  // Requests permission, gets the native device token (FCM on Android,
  // APNs on iOS), and POSTs it to our backend for storage.
  const registerForPushNotifications = useCallback(async (): Promise<void> => {
    try {
      // 1. Check / request permission
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        // User declined — nothing we can do
        return;
      }

      // 2. Get the native device push token (FCM token on Android, APNs on iOS).
      //    We use getDevicePushTokenAsync() instead of getExpoPushTokenAsync()
      //    because the backend sends directly via FCM HTTP v1 API.
      const { data: deviceToken } = await Notifications.getDevicePushTokenAsync();

      // Normalise — on Android this is a string, on iOS it can be a string
      const token = typeof deviceToken === 'string' ? deviceToken : String(deviceToken);
      tokenRef.current = token;

      // 3. Send the token to our backend
      await api.post('/users/fcm-token', { token });

      // 4. Set up the Android notification channel (required for Android 8+)
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#2563EB',
        });
      }
    } catch (err) {
      // Push notifications are non-critical — log and continue
      console.warn('Push notification registration failed:', err);
    }
  }, []);

  // ─── Unregister push token ────────────────────────────────
  // Call this on logout to remove the device token from the backend
  // so the user stops receiving push notifications on this device.
  const unregisterPushToken = useCallback(async (): Promise<void> => {
    try {
      await api.delete('/users/fcm-token');
      tokenRef.current = null;
    } catch {
      // Best-effort — don't block logout
    }
  }, []);

  // ─── Listen for token refresh ─────────────────────────────
  // Device tokens can change (e.g. after app reinstall, OS update).
  // Re-sync with the backend whenever the OS issues a new one.
  useEffect(() => {
    const subscription = Notifications.addPushTokenListener(async (newToken) => {
      const token =
        typeof newToken.data === 'string' ? newToken.data : String(newToken.data);
      tokenRef.current = token;
      try {
        await api.post('/users/fcm-token', { token });
      } catch {
        console.warn('Failed to sync refreshed push token');
      }
    });

    return () => subscription.remove();
  }, []);

  return {
    registerForPushNotifications,
    unregisterPushToken,
  };
}
