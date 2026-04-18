import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-storage.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

// upload/js/firebase-config.js 와 동일한 값 사용
const firebaseConfig = {
  apiKey: "AIzaSyAGxy3vri7DWXXlkiP0k-bFWImerbliQXM",
  authDomain: "nth-pottery-363101.firebaseapp.com",
  projectId: "nth-pottery-363101",
  storageBucket: "nth-pottery-363101.firebasestorage.app",
  messagingSenderId: "911683179558",
  appId: "1:911683179558:web:6fe9e68741d291499802e7"
};

const app = initializeApp(firebaseConfig);
export const storage = getStorage(app);
export const db = getFirestore(app);
