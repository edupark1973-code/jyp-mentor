'use client';

import { useEffect, useState, Suspense } from 'react';
import { collection, query, onSnapshot, doc, updateDoc, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/useAuthStore';
import { Users, ShieldCheck, UserCog, Loader2, ChevronLeft, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';

function AdminUserContent() {
  const router = useRouter();
  const { user, role, loading: authLoading } = useAuthStore();
  const [users, setUsers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // 본인이 관리자가 아니면 메인으로 튕겨냄
    if (!authLoading && role !== 'admin') {
      router.push('/');
      return;
    }

    // 가입된 사용자 목록 실시간 감시
    const q = query(collection(db, 'users'), orderBy('displayName', 'asc'));
    const unsub = onSnapshot(q, (s) => {
      setUsers(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => unsub();
  }, [role, authLoading, router]);

  const toggleAdmin = async (targetUser: any) => {
    const newRole = targetUser.role === 'admin' ? 'user' : 'admin';
    const message = newRole === 'admin' 
      ? `[${targetUser.displayName}] 님에게 관리자(강사) 권한을 부여하시겠습니까?`
      : `[${targetUser.displayName}] 님의 관리자 권한을 회수하시겠습니까?`;

    if (confirm(message)) {
      try {
        await updateDoc(doc(db, 'users', targetUser.id), { role: newRole });
        alert('권한이 변경되었습니다.');
      } catch (e) {
        console.error(e);
        alert('권한 변경 중 오류가 발생했습니다.');
      }
    }
  };

  const filteredUsers = users.filter(u => 
    u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (authLoading) return <div className="h-screen flex items-center justify-center bg-white"><Loader2 className="animate-spin text-blue-600" /></div>;
  if (role !== 'admin') return null;

  return (
    <div className="min-h-screen bg-slate-50 p-8 text-slate-900">
      <div className="max-w-4xl mx-auto">
        <header className="flex justify-between items-center mb-10">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/')} className="p-3 bg-white rounded-2xl shadow-sm hover:bg-slate-100 transition-all">
              <ChevronLeft size={20} />
            </button>
            <h1 className="text-3xl font-black flex items-center gap-3">
              <UserCog className="text-blue-600" size={32} /> 강사 및 사용자 관리
            </h1>
          </div>
          <div className="px-5 py-2 bg-blue-600 text-white rounded-full font-black text-sm shadow-lg shadow-blue-100">
            총 {users.length}명 가입됨
          </div>
        </header>

        {/* 검색바 */}
        <div className="relative mb-8">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="이름 또는 이메일로 검색..." 
            className="w-full pl-14 pr-6 py-4 bg-white border border-slate-100 rounded-[1.5rem] shadow-sm outline-none focus:border-blue-500 font-bold"
          />
        </div>

        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-50 text-slate-400 text-xs font-black uppercase tracking-widest">
                <th className="px-8 py-5">사용자 정보</th>
                <th className="px-8 py-5">현재 권한</th>
                <th className="px-8 py-5 text-right">권한 변경</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredUsers.map((target) => (
                <tr key={target.id} className="hover:bg-slate-50/30 transition-colors">
                  <td className="px-8 py-6">
                    <p className="font-black text-lg">{target.displayName}</p>
                    <p className="text-slate-400 text-xs font-bold">{target.email}</p>
                  </td>
                  <td className="px-8 py-6">
                    {target.role === 'admin' ? (
                      <span className="flex items-center gap-1.5 text-blue-600 font-black text-xs uppercase bg-blue-50 px-3 py-1.5 rounded-full w-fit">
                        <ShieldCheck size={14} /> Instructor
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-slate-400 font-black text-xs uppercase bg-slate-100 px-3 py-1.5 rounded-full w-fit">
                        Student
                      </span>
                    )}
                  </td>
                  <td className="px-8 py-6 text-right">
                    {/* 자기 자신의 권한은 변경 못하게 처리 */}
                    {target.id !== user?.uid && (
                      <button 
                        onClick={() => toggleAdmin(target)}
                        className={`px-4 py-2 rounded-xl font-black text-xs transition-all ${
                          target.role === 'admin'
                          ? 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          : 'bg-slate-900 text-white hover:bg-black shadow-lg shadow-slate-200'
                        }`}
                      >
                        {target.role === 'admin' ? '권한 회수' : '강사 임명'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredUsers.length === 0 && (
            <div className="py-20 text-center text-slate-300 font-bold italic">검색 결과가 없습니다.</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminUserPage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center bg-white"><Loader2 className="animate-spin text-blue-600" /></div>}>
      <AdminUserContent />
    </Suspense>
  );
}