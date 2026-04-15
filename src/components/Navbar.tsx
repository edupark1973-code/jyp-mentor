'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/store/useAuthStore';
import { signInWithPopup, GoogleAuthProvider, signOut, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { X, Lock, Mail } from 'lucide-react';

export default function Navbar() {
  const { user, role } = useAuthStore();
  
  const [isPublicModalOpen, setIsPublicModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // 1. 구글 로그인 (계정 선택 창 강제 호출)
  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Google Login Error:', error);
    }
  };

  // 2. 공용 강사 로그인 (이메일 & 비밀번호)
  const handlePublicLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setIsPublicModalOpen(false);
      setEmail(''); 
      setPassword('');
    } catch (error) {
      alert('아이디 또는 비밀번호가 일치하지 않습니다.');
    }
  };

  return (
    <nav className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-xl font-bold text-blue-600 italic">
            EduReport
          </Link>
          
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <Link href="/" className="hover:text-blue-600 transition-colors font-bold">홈 (전체 강좌)</Link>
            <Link href="/mentoring" className="hover:text-blue-600 transition-colors font-bold">멘토링 예약</Link>
          </div>
        </div>
        
        <div className="flex items-center gap-6 text-sm font-medium text-slate-600">
          {role === 'admin' && (
            <div className="flex items-center gap-4 border-l pl-6 border-slate-200">
              <Link href="/admin/mentoring" className="text-slate-500 hover:text-blue-600 transition-colors font-bold">멘토링 관리</Link>
            </div>
          )}

          {user ? (
            <div className="flex items-center gap-4">
              <span className="text-slate-500 hidden sm:inline font-bold">{user.displayName || '공용 강사'}님</span>
              <button 
                onClick={() => signOut(auth)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-bold text-xs"
              >
                로그아웃
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsPublicModalOpen(true)}
                className="px-4 py-2 text-slate-500 font-bold hover:text-slate-800 transition-colors text-xs"
              >
                공용 로그인
              </button>
              <button 
                onClick={handleGoogleLogin}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-bold text-xs"
              >
                구글 로그인
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 공용 로그인 모달창 UI */}
      {isPublicModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setIsPublicModalOpen(false)}>
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-sm shadow-2xl relative animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <button onClick={() => setIsPublicModalOpen(false)} className="absolute top-6 right-6 text-slate-300 hover:text-slate-500 transition-colors">
              <X size={20}/>
            </button>
            <h2 className="text-2xl font-black mb-6 text-slate-900">공용 강사 접속</h2>
            <form onSubmit={handlePublicLogin} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="공용 이메일 아이디" className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition-all font-bold text-slate-900" required />
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="비밀번호" className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition-all font-bold text-slate-900" required />
              </div>
              <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-xl font-black shadow-lg active:scale-95 transition-all mt-2 hover:bg-black">로그인</button>
            </form>
          </div>
        </div>
      )}
    </nav>
  );
}