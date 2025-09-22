// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCwveY6gv9TCaaLUkp9ZyaHLKSlJgsB1h4",
  authDomain: "appccdt.firebaseapp.com",
  projectId: "appccdt",
  storageBucket: "appccdt.firebasestorage.app",
  messagingSenderId: "807401870234",
  appId: "1:807401870234:web:cb58cd39de14bbbedd2023",
  measurementId: "G-PWC58EVX21"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);