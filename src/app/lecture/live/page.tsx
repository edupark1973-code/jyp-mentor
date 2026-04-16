'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { collection, query, where, onSnapshot, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/useAuthStore';
import { Trash2, Loader2, ChevronLeft } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

function LiveContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lectureId = searchParams.get('id');
  const { role } = useAuthStore();
  const [questions, setQuestions] = useState<any[]>([]);
  const [origin, setOrigin] = useState('');

  // window 에러 방지용 클라이언트 사이드 체크
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!lectureId) return;
    const q = query(collection(db, 'questions'), where('lectureId', '==', lectureId), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (s) => setQuestions(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsub();
  }, [lectureId]);

  const handleDelete = async (id: string) => {
    if (confirm('질문을 삭제하시겠습니까?')) await deleteDoc(doc(db, 'questions', id));
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push('/');
    }
  };

  if (!lectureId) return <div className="p-10 text-center">강좌 ID가 없습니다.</div>;

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-900 text-white relative">
      {/* 뒤로가기 버튼 */}
      <button 
        onClick={handleBack} 
        className="fixed top-4 left-4 md:top-8 md:left-8 p-2 md:p-3 bg-white/5 hover:bg-white/10 rounded-xl md:rounded-2xl border border-white/10 text-white transition-all z-50 shadow-lg backdrop-blur-md"
        title="뒤로가기"
      >
        <ChevronLeft size={20} className="md:w-6 md:h-6" />
      </button>

      {/* QR 코드 섹션 (왼쪽/상단) */}
      <div className="w-full lg:w-1/3 lg:h-screen lg:border-r border-white/10 p-6 md:p-12 flex flex-col items-center justify-center text-center bg-slate-900/50 backdrop-blur-xl shrink-0">
        <h2 className="text-3xl md:text-5xl font-black mb-6 md:mb-12 italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-blue-400 to-indigo-400">Live Q&A</h2>
        <div className="p-4 md:p-8 bg-white rounded-[2rem] md:rounded-[3.5rem] shadow-[0_0_50px_rgba(59,130,246,0.2)] border-4 border-white/5 mb-6 md:mb-10">
          {origin && (
            <div className="w-[180px] h-[180px] md:w-[280px] md:h-[280px]">
              <QRCodeSVG value={`${origin}/qna?id=${lectureId}`} size={undefined} className="w-full h-full" />
            </div>
          )}
        </div>
        <div className="space-y-2 px-4 max-w-full overflow-hidden">
          <p className="text-blue-400 font-black text-lg md:text-2xl tracking-widest uppercase truncate">포스트 쓰기 링크</p>
          <a href={`${origin}/qna?id=${lectureId}`} target="_blank" rel="noopener noreferrer" className="block text-slate-400 underline hover:text-blue-300 text-xs md:text-sm break-all font-bold opacity-70">
            {origin}/qna?id={lectureId}
          </a>
          <p className="text-slate-500 font-bold leading-relaxed text-[10px] md:text-sm uppercase tracking-[0.2em] mt-4">Scan to ask a question</p>
        </div>
      </div>

      {/* 포스트 목록 섹션 (오른쪽/하단) */}
      <div className="w-full lg:w-2/3 lg:h-screen bg-slate-900/30 p-6 md:p-16 overflow-y-auto custom-scrollbar">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8 md:mb-16">
          <div className="space-y-2">
            <h1 className="text-2xl md:text-4xl font-black tracking-tight">포스트 목록</h1>
            <p className="text-slate-500 font-bold text-xs md:text-sm">실시간으로 올라오는 수강생들의 대화입니다.</p>
          </div>
          <div className="px-4 py-1.5 md:px-8 md:py-3 bg-blue-600/20 text-blue-400 rounded-full border border-blue-500/30 font-black text-[10px] md:text-sm uppercase tracking-widest whitespace-nowrap">
            {questions.length} Questions
          </div>
        </header>

        <div className="space-y-4 md:space-y-6">
          {questions.map((q) => (
            <div key={q.id} className="bg-white/5 p-6 md:p-10 rounded-[1.5rem] md:rounded-[3rem] border border-white/10 flex justify-between items-start group hover:border-blue-500/30 transition-all backdrop-blur-sm">
              <div className="flex-1 min-w-0">
                <p className="text-lg md:text-3xl font-bold text-white mb-4 md:mb-6 leading-tight tracking-tight break-words">{q.text}</p>
                <div className="flex items-center gap-2 text-slate-500 font-black text-[10px] md:text-xs uppercase tracking-widest">
                  <div className="w-1 md:w-1.5 h-1 md:h-1.5 bg-blue-500 rounded-full"></div>
                  {q.author || 'Anonymous Student'}
                </div>
              </div>
              {role === 'admin' && (
                <button onClick={() => handleDelete(q.id)} className="p-2 md:p-4 text-slate-600 hover:text-red-500 hover:bg-red-500/10 rounded-xl md:rounded-2xl transition-all shrink-0">
                  <Trash2 size={18} className="md:w-6 md:h-6" />
                </button>
              )}
            </div>
          ))}
          {questions.length === 0 && (
            <div className="py-20 md:py-40 text-center space-y-4 md:space-y-6">
              <div className="w-16 h-16 md:w-24 md:h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto border border-white/5">
                <Loader2 className="text-slate-700 w-8 h-8 md:w-10 md:h-10 animate-spin" />
              </div>
              <p className="text-slate-600 font-black italic text-lg md:text-2xl uppercase tracking-tighter">Waiting for questions...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LivePage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>}>
      <LiveContent />
    </Suspense>
  );
}