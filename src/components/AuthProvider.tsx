'use client';

import { useEffect } from 'react';
import { onAuthStateChanged, getRedirectResult } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { ensureUserRole, isDesignatedMentor } from '@/lib/userRole';
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
      setLoading(true);
      setUser(user);
      try {
        if (user) {
          setRole(await ensureUserRole(user));
        } else {
          setRole(null);
        }
      } catch (error) {
        console.error('Failed to synchronize the user session:', error);
        // 기존 사용자 문서 마이그레이션이나 일시적인 Firestore 오류가 있어도
        // 로그인한 사용자가 워크스페이스 진입점을 잃지 않도록 기본 역할을 유지한다.
        setRole(user ? (isDesignatedMentor(user.email) ? 'mentor' : 'mentee') : null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [setUser, setRole, setLoading]);

  return <>{children}</>;
}
