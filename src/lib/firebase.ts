import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDXIZv1G3UroePQrFCGoNZHhOo-Mtoa7y0",
  authDomain: "jyp-mentor.web.app",
  projectId: "jyp-mentor",
  storageBucket: "jyp-mentor.firebasestorage.app",
  messagingSenderId: "355587772198",
  appId: "1:355587772198:web:163189a8e3c9e3795cfbe7"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
