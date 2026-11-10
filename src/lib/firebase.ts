import { getApp, getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import {
  connectFirestoreEmulator,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { connectStorageEmulator, getStorage } from "firebase/storage";
const firebaseConfig = {
  apiKey: "AIzaSyACqXsgzMO_pxxJ4LeyjbXyqwMa2wyjOvs",
  authDomain: "commandegileada.firebaseapp.com",
  databaseURL: "https://commandegileada-default-rtdb.firebaseio.com",
  projectId: "commandegileada",
  storageBucket: "commandegileada.firebasestorage.app",
  messagingSenderId: "862591451897",
  appId: "1:862591451897:web:fbb109323c3ad782671828",
  measurementId: "G-4PD76CJG0F",
};
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
const trusted = localStorage.getItem("noteo:trusted") === "true";
export const db = initializeFirestore(app, {
  localCache: trusted
    ? persistentLocalCache({ tabManager: persistentMultipleTabManager() })
    : memoryLocalCache(),
});
export const storage = getStorage(app);
if (import.meta.env.VITE_USE_EMULATORS === "true") {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
}
export async function enableAnalytics() {
  try {
    const { isSupported, getAnalytics } = await import("firebase/analytics");
    if (await isSupported()) getAnalytics(app);
  } catch {
    /* optional telemetry */
  }
}
