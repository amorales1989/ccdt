importScripts("https://www.gstatic.com/firebasejs/11.9.1/firebase-app-compat.js")
importScripts("https://www.gstatic.com/firebasejs/11.9.1/firebase-messaging-compat.js")

const firebaseConfig = {
  apiKey: "AIzaSyDWjjW05rHSLBwCkfovpjDogTvTMzYQ70k",
  authDomain: "notificaciones-ccdt.firebaseapp.com",
  projectId: "notificaciones-ccdt",
  storageBucket: "notificaciones-ccdt.firebasestorage.app",
  messagingSenderId: "249176889830",
  appId: "1:249176889830:web:0f10d43a9413f947639e27",
  measurementId: "G-6TG6FFK0FK"
};

const app = firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging(app)

messaging.onBackgroundMessage(payload => {
    console.log("resibiste el un mensaje")
    const notificacionTitulo = payload.notification.title;
    const notif = {
        body: payload.notification.body,
        icon: "/fire.png"
    }
    return self.registration.showNotification(
        notificacionTitulo,
        notif
    )
})