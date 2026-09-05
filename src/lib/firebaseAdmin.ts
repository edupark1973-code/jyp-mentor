import 'server-only';

// Firebase Hosting의 Next.js 패키저가 firebase-admin/* ESM 서브패스를
// 해시 별칭으로 바꾸는 문제를 피하기 위해 루트 CommonJS 진입점을 사용한다.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const admin = require('firebase-admin');

export const serverTimestamp = () => admin.firestore.FieldValue.serverTimestamp();

export function getFirebaseAdmin() {
  const existingApp = admin.apps[0];
  if (existingApp) {
    return { adminAuth: admin.auth(existingApp), adminDb: admin.firestore(existingApp) };
  }

  const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'jyp-mentor';
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const credential = clientEmail && privateKey
    ? admin.credential.cert({ projectId, clientEmail, privateKey })
    : admin.credential.applicationDefault();
  const app = admin.initializeApp({ projectId, credential });

  return { adminAuth: admin.auth(app), adminDb: admin.firestore(app) };
}
