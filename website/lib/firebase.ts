// lib/firebase.ts
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: "AIzaSyA87FjzN1o4s2zTkALbVQAzBbRX5juerAE",
    authDomain: "dacroq.firebaseapp.com",
    projectId: "dacroq",
    storageBucket: "dacroq.appspot.com", // Note: Fixed storage bucket URL
    messagingSenderId: "846824505705",
    appId: "1:846824505705:web:757835aad0777cdc7c7df8",
    measurementId: "G-2ZM55B3QFY"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

export { db, storage };
