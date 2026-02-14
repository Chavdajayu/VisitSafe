import { getMessaging, getToken, deleteToken } from "firebase/messaging";
import { app, db } from "./firebase";
import { doc, getDoc, setDoc, serverTimestamp, updateDoc } from "firebase/firestore";

let messaging = null;

export const initMessaging = async () => {
  if (typeof window !== "undefined" && "serviceWorker" in navigator) {
    try {
      messaging = getMessaging(app);
      return messaging;
    } catch (error) {
      console.error("Messaging initialization failed", error);
    }
  }
  return null;
};

// Request and Save Token (Call this on Login or Home Load)
export const requestToken = async (userId, role = 'resident', residencyId) => {
  if (!messaging) await initMessaging();
  if (!messaging) return;

  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      const registration = await navigator.serviceWorker.ready;

      const token = await getToken(messaging, {
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
        serviceWorkerRegistration: registration
      });

      if (token) {
        console.log("FCM Token secured:", token.slice(0, 10) + "...");
        if (userId && residencyId) {
          await saveTokenToFirestore(token, userId, role, residencyId);
        }
        return token;
      }
    } else {
      console.log("Notification permission denied");
    }
  } catch (error) {
    console.error("Error retrieving token:", error);
  }
};

// Delete Token (Call on Logout)
export const clearToken = async (userId, role, residencyId) => {
  if (!messaging) await initMessaging();
  if (!messaging) return;

  try {
    await deleteToken(messaging);
    // Also remove from Firestore
    if (userId && residencyId) {
      await removeTokenFromFirestore(userId, role, residencyId);
    }
  } catch (e) {
    console.error("Error clearing token:", e);
  }
}

const saveTokenToFirestore = async (token, userId, role, residencyId) => {
  try {
    if (!residencyId || !userId || !token) return;

    let userRef = null;
    let fieldKey = 'fcmToken';
    let timestampKey = 'fcmUpdatedAt';

    if (role === "admin") {
      userRef = doc(db, "residencies", residencyId);
      fieldKey = 'adminFcmToken';
      timestampKey = 'adminFcmUpdatedAt';
    } else if (role === "resident") {
      userRef = doc(db, "residencies", residencyId, "residents", userId);
    } else if (role === "guard") {
      userRef = doc(db, "residencies", residencyId, "guards", userId);
    }

    if (userRef) {
      // 1. Check existing to avoid redundant writes if explicitly the same
      // However, we MUST ensure the token is associated with THIS user.
      const docSnap = await getDoc(userRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data[fieldKey] === token) {
          console.log("Token already up to date for", userId);
          return;
        }
      }

      // 2. Overwrite token (One device policy enforced by overwriting)
      await setDoc(userRef, {
        [fieldKey]: token,
        [timestampKey]: serverTimestamp()
      }, { merge: true });

      console.log("Token saved to Firestore for", userId);
    }
  } catch (err) {
    console.error("Error saving token to Firestore:", err);
  }
};

const removeTokenFromFirestore = async (userId, role, residencyId) => {
  try {
    if (!residencyId || !userId) return;

    let userRef = null;
    let fieldKey = 'fcmToken';

    if (role === "admin") {
      userRef = doc(db, "residencies", residencyId);
      fieldKey = 'adminFcmToken';
    } else if (role === "resident") {
      userRef = doc(db, "residencies", residencyId, "residents", userId);
    } else if (role === "guard") {
      userRef = doc(db, "residencies", residencyId, "guards", userId);
    }

    if (userRef) {
      await updateDoc(userRef, {
        [fieldKey]: null
      });
      console.log("Token removed from Firestore for", userId);
    }
  } catch (e) {
    console.error("Failed to remove token from DB", e);
  }
}
