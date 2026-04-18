import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-storage.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';

// ============================================
// Firebase 설정 - 아래 값을 본인의 Firebase 프로젝트 설정으로 교체하세요
// Firebase Console > 프로젝트 설정 > 일반 > 내 앱 > 웹 앱에서 확인 가능
// ============================================
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
export const auth = getAuth(app);

/**
 * 익명 인증을 보장합니다. 이미 로그인되어 있으면 기존 사용자를 반환하고,
 * 아니면 익명으로 로그인합니다.
 * @returns {Promise<import('firebase/auth').User>}
 */
export function ensureAuth() {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      if (user) {
        resolve(user);
      } else {
        signInAnonymously(auth).then((cred) => resolve(cred.user)).catch(reject);
      }
    }, reject);
  });
}
