// lib/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyDBRt3wTLTTYCdci5YSssWfX7EfwsDT67g",
    authDomain: "dacroq-69002.firebaseapp.com",
    projectId: "dacroq-69002",
    storageBucket: "dacroq-69002.firebasestorage.app",
    messagingSenderId: "593421475385",
    appId: "1:593421475385:web:c1c4fc9c0fbe9e5a98b7e8"
  };

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export { auth, db, googleProvider, signInWithPopup };