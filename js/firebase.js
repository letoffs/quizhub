// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC-lCnXfQS8rndnsCayVEVQxQrOK4pJyEI",
  authDomain: "quizhub-6fe5e.firebaseapp.com",
  databaseURL: "https://quizhub-6fe5e-default-rtdb.firebaseio.com/",
  projectId: "quizhub-6fe5e",
  storageBucket: "quizhub-6fe5e.firebasestorage.app",
  messagingSenderId: "5879856819",
  appId: "1:5879856819:web:53b3508c0ba52e94387ac6",
  measurementId: "G-SQ5419CRCY"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);