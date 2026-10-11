import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: 'AIzaSyC1hynNopglp2m1MB2LAFqLWITDSomQSwM',
  authDomain: 'quoc-71c8f.firebaseapp.com',
  projectId: 'quoc-71c8f',
  storageBucket: 'quoc-71c8f.firebasestorage.app',
  messagingSenderId: '1007519741887',
  appId: '1:1007519741887:web:8363ca96d4f8e66943d30a',
  measurementId: 'G-6J73TDM0D6',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);

if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) getAnalytics(app);
  }).catch(() => {});
}