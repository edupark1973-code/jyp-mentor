'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { signInWithPopup, signInWithRedirect, GoogleAuthProvider, signOut, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { X, Lock, Mail, Menu } from 'lucide-react';

export default function Navbar() {
  const { user, role } = useAuthStore();
  const pathname = usePathname();
  
  const [isPublicModalOpen, setIsPublicModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const isActive = (path: string) => pathname === path;

  // 1. 구글 로그인 (모바일/데스크톱 분기 처리)
  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    
    try {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        await signInWithRedirect(auth, provider);
      } else {
        await signInWithPopup(auth, provider);
      }
    } catch (error) {
      console.error('Google Login Error:', error);
      alert('로그인 중 오류가 발생했습니다. 크롬이나 사파리 브라우저에서 시도해주세요.');
    }
  };

  // 2. 공용 강사 로그인
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
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="flex justify-between items-center h-16 md:h-20">
          <div className="flex items-center gap-4 md:gap-8">
            <button 
              onClick={() => window.location.href = '/'} 
              className="text-xl md:text-2xl font-black text-blue-600 italic tracking-tighter"
            >
              EduReport
            </button>
            
            <div className="hidden md:flex items-center gap-6 text-sm font-bold text-slate-600">
              <button 
                onClick={() => window.location.href = '/'} 
                className={`${isActive('/') ? 'text-blue-600' : 'hover:text-blue-600'} transition-colors`}
              >
                홈
              </button>
              <Link href="/mentoring" className={`${isActive('/mentoring') ? 'text-blue-600' : 'hover:text-blue-600'} transition-colors`}>멘토링 예약</Link>
            </div>
          </div>
          
          <div className="flex items-center gap-2 md:gap-4">
            {role === 'admin' && (
              <div className="hidden md:flex items-center gap-4 border-l pl-6 border-slate-200">
                <Link href="/admin/mentoring" className={`${isActive('/admin/mentoring') ? 'text-blue-600' : 'text-slate-500 hover:text-blue-600'} transition-colors font-bold text-sm`}>멘토링 관리</Link>
                <Link href="/admin/users" className={`${isActive('/admin/users') ? 'text-blue-600' : 'text-slate-500 hover:text-blue-600'} transition-colors font-bold text-sm`}>사용자 관리</Link>
              </div>
            )}

            <div className="hidden md:flex items-center gap-3">
              {user ? (
                <>
                  <span className="text-slate-500 font-bold text-sm">{user.displayName || '공용 강사'}님</span>
                  <button onClick={() => signOut(auth)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-bold text-xs">로그아웃</button>
                </>
              ) : (
                <>
                  <button onClick={() => setIsPublicModalOpen(true)} className="px-3 py-2 text-slate-500 font-bold hover:text-slate-800 text-xs">공용 로그인</button>
                  <button onClick={handleGoogleLogin} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-bold text-xs">구글 로그인</button>
                </>
              )}
            </div>

            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-slate-100 px-4 py-6 space-y-4 animate-in slide-in-from-top duration-300 shadow-xl">
          <div className="flex flex-col gap-2 font-bold text-slate-600">
            <Link href="/" onClick={() => setIsMobileMenuOpen(false)} className={`${isActive('/') ? 'text-blue-600 bg-blue-50' : 'hover:bg-slate-50'} p-4 rounded-xl transition-all`}>홈</Link>
            <Link href="/mentoring" onClick={() => setIsMobileMenuOpen(false)} className={`${isActive('/mentoring') ? 'text-blue-600 bg-blue-50' : 'hover:bg-slate-50'} p-4 rounded-xl transition-all`}>멘토링 예약</Link>
            {role === 'admin' && (
              <>
                <Link href="/admin/mentoring" onClick={() => setIsMobileMenuOpen(false)} className={`${isActive('/admin/mentoring') ? 'text-blue-600 bg-blue-50' : 'hover:bg-slate-50'} p-4 rounded-xl transition-all border-t border-slate-50 pt-4`}>멘토링 관리</Link>
                <Link href="/admin/users" onClick={() => setIsMobileMenuOpen(false)} className={`${isActive('/admin/users') ? 'text-blue-600 bg-blue-50' : 'hover:bg-slate-50'} p-4 rounded-xl transition-all`}>사용자 관리</Link>
              </>
            )}
          </div>
          <div className="pt-4 border-t border-slate-100 flex flex-col gap-3">
            {user ? (
              <button onClick={() => { signOut(auth); setIsMobileMenuOpen(false); }} className="w-full p-4 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm">로그아웃</button>
            ) : (
              <>
                <button onClick={() => { setIsPublicModalOpen(true); setIsMobileMenuOpen(false); }} className="w-full p-4 text-slate-500 font-bold text-sm text-center">공용 로그인</button>
                <button onClick={() => { handleGoogleLogin(); setIsMobileMenuOpen(false); }} className="w-full p-4 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-lg">구글 로그인</button>
              </>
            )}
          </div>
        </div>
      )}

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
