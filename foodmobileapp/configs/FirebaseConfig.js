import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAl9AY_XxoBkc2rEdWB-DOBZpiaLVkQWCQ",
  authDomain: "fooda-44779.firebaseapp.com",
  projectId: "fooda-44779",
  storageBucket: "fooda-44779.firebasestorage.app",
  messagingSenderId: "272057552162",
  appId: "1:272057552162:web:83829b59ab5b5dc84e297b",
  measurementId: "G-S9HN1M9P7N"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);