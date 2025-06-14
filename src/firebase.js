import { initializeApp } from "firebase/app";
import { getMessaging } from "firebase/messaging"
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyDWjjW05rHSLBwCkfovpjDogTvTMzYQ70k",
  authDomain: "notificaciones-ccdt.firebaseapp.com",
  projectId: "notificaciones-ccdt",
  storageBucket: "notificaciones-ccdt.firebasestorage.app",
  messagingSenderId: "249176889830",
  appId: "1:249176889830:web:0f10d43a9413f947639e27",
  measurementId: "G-6TG6FFK0FK"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const messaging = getMessaging(app)