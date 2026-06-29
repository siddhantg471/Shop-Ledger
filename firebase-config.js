// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";


const firebaseConfig = {
  apiKey: "AIzaSyAH2x-NOnWqm45Z04lYd0f3Xm6Y1zxGBxA",
  authDomain: "laedger-of-shop.firebaseapp.com",
  projectId: "laedger-of-shop",
  storageBucket: "laedger-of-shop.firebasestorage.app",
  messagingSenderId: "783831037063",
  appId: "1:783831037063:web:37efabb44e1801cedfb422",
  measurementId: "G-S3ZH66TEJW"
};


let app, auth, db;
let isFirebaseConfigured = firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY";

if (isFirebaseConfigured) {
    try {
        // Initialize Firebase
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        console.log("Firebase initialized successfully.");
    } catch (error) {
        console.error("Error initializing Firebase:", error);
        isFirebaseConfigured = false;
    }
} else {
    console.warn("⚠️ Firebase is not configured. Running in Local Storage (Mock) mode.");
    console.warn("To enable database and auth, add your credentials in firebase-config.js");
}

export { app, auth, db, isFirebaseConfigured };
