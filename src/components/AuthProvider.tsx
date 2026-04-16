'use client';

import { useEffect } from 'react';
import { onAuthStateChanged, getRedirectResult } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useAuthStore } from '@/store/useAuthStore';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setRole, setLoading } = useAuthStore();

  useEffect(() => {
    // 1. 리다이렉트 결과 처리 (모바일용)
    const handleRedirectResult = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          console.log('✅ Redirect login success:', result.user.email);
        }
      } catch (error) {
        console.error('❌ Redirect login error:', error);
      }
    };
    handleRedirectResult();

    // 2. 인증 상태 감시
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          setRole(userDoc.data().role as 'admin' | 'user');
        } else {
          // If first time login, create user doc with 'user' role
          const defaultRole = 'user';
          await setDoc(userRef, {
            email: user.email,
            displayName: user.displayName,
            role: defaultRole,
            createdAt: new Date().toISOString()
          });
          setRole(defaultRole);
        }
      } else {
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [setUser, setRole, setLoading]);

  return <>{children}</>;
}
