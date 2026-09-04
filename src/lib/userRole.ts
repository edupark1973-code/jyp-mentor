import type { User } from 'firebase/auth';
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export type UserRole = 'mentor' | 'mentee';

export const DESIGNATED_MENTOR_EMAIL = 'edupark1973@gmail.com';

function normalizeEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() ?? '';
}

export function isDesignatedMentor(email: string | null | undefined) {
  return normalizeEmail(email) === DESIGNATED_MENTOR_EMAIL;
}

export function isUserRole(value: unknown): value is UserRole {
  return value === 'mentor' || value === 'mentee';
}

/** Firebase Auth 사용자와 users/{uid} 문서를 동기화하고 세션 역할을 반환한다. */
export async function ensureUserRole(user: User): Promise<UserRole> {
  const userRef = doc(db, 'users', user.uid);

  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(userRef);
    const storedRole = snapshot.data()?.role;
    const role: UserRole = isDesignatedMentor(user.email)
      ? 'mentor'
      : isUserRole(storedRole)
        ? storedRole
        : 'mentee';

    transaction.set(userRef, {
      uid: user.uid,
      email: normalizeEmail(user.email),
      displayName: user.displayName ?? null,
      role,
      ...(snapshot.exists() ? {} : { createdAt: serverTimestamp() }),
    }, { merge: true });

    return role;
  });
}
