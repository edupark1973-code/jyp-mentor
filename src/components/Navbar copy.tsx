'use client';

import Link from 'next/link';
import { useAuthStore } from '@/store/useAuthStore';
import { signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function Navbar() {
  const { user, role } = useAuthStore();

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    
    // 👉 [추가된 핵심 코드] 무조건 구글 계정 선택 창을 띄우도록 설정합니다.
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login Error:', error);
    }
  };

  return (
    <nav className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-xl font-bold text-blue-600">
            EduFiles
          </Link>
          
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <Link href="/" className="hover:text-blue-600 transition-colors">홈</Link>
            <Link href="/mentoring" className="hover:text-blue-600 transition-colors">멘토링 예약</Link>
          </div>
        </div>
        
        <div className="flex items-center gap-6 text-sm font-medium text-slate-600">
          {role === 'admin' && (
            <div className="flex items-center gap-4 border-l pl-6 border-slate-200">
              <Link href="/admin/mentoring" className="text-slate-500 hover:text-blue-600 transition-colors">멘토링 관리</Link>
            </div>
          )}

          {user ? (
            <div className="flex items-center gap-4">
              <span className="text-slate-500 hidden sm:inline">{user.displayName}님</span>
              <button 
                onClick={() => signOut(auth)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
              >
                로그아웃
              </button>
            </div>
          ) : (
            <button 
              onClick={handleLogin}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              로그인
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}