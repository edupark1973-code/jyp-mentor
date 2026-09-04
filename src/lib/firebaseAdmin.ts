import 'server-only';

import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export function getFirebaseAdmin() {
  const existingApp = getApps()[0];
  if (existingApp) {
    return { adminAuth: getAuth(existingApp), adminDb: getFirestore(existingApp) };
  }

  const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'jyp-mentor';
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const credential = clientEmail && privateKey
    ? cert({ projectId, clientEmail, privateKey })
    : applicationDefault();
  const app = initializeApp({ projectId, credential });

  return { adminAuth: getAuth(app), adminDb: getFirestore(app) };
}
