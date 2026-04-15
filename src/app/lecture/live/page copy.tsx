'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { collection, query, where, onSnapshot, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/useAuthStore';
import { Trash2, Loader2, ChevronLeft } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

function LiveContent() {
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

  if (!lectureId) return <div className="p-10 text-center">강좌 ID가 없습니다.</div>;

  return (
    <div className="flex h-screen bg-slate-900 text-white overflow-hidden relative">
      {/* 뒤로가기 버튼 */}
      <button 
        onClick={() => window.close()} 
        className="absolute top-8 left-8 p-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 text-white transition-all z-50 shadow-lg backdrop-blur-md"
        title="닫기"
      >
        <ChevronLeft size={24} />
      </button>

      <div className="w-1/3 border-r border-white/10 p-12 flex flex-col items-center justify-center text-center bg-slate-900/50 backdrop-blur-xl">
        <h2 className="text-5xl font-black mb-12 italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-blue-400 to-indigo-400">Live Q&A</h2>
        <div className="p-8 bg-white rounded-[3.5rem] shadow-[0_0_50px_rgba(59,130,246,0.2)] border-4 border-white/5 mb-10">
          {origin && <QRCodeSVG value={`${origin}/qna?id=${lectureId}`} size={280} />}
        </div>
        <div className="space-y-2">
          <p className="text-blue-400 font-black text-2xl tracking-widest uppercase">ID: {lectureId}</p>
          <p className="text-slate-500 font-bold leading-relaxed text-sm uppercase tracking-[0.2em]">Scan to ask a question</p>
        </div>
      </div>

      <div className="w-2/3 bg-slate-900/30 p-16 overflow-y-auto custom-scrollbar">
        <header className="flex justify-between items-end mb-16">
          <div className="space-y-2">
            <h1 className="text-4xl font-black tracking-tight">포스트 목록</h1>
            <p className="text-slate-500 font-bold text-sm">실시간으로 올라오는 수강생들의 대화입니다.</p>
          </div>
          <div className="px-8 py-3 bg-blue-600/20 text-blue-400 rounded-full border border-blue-500/30 font-black text-sm uppercase tracking-widest">
            {questions.length} Questions
          </div>
        </header>

        <div className="space-y-6">
          {questions.map((q) => (
            <div key={q.id} className="bg-white/5 p-10 rounded-[3rem] border border-white/10 flex justify-between items-start group hover:border-blue-500/30 transition-all backdrop-blur-sm">
              <div className="flex-1">
                <p className="text-3xl font-bold text-white mb-6 leading-tight tracking-tight">{q.text}</p>
                <div className="flex items-center gap-2 text-slate-500 font-black text-xs uppercase tracking-widest">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                  {q.author || 'Anonymous Student'}
                </div>
              </div>
              {role === 'admin' && (
                <button onClick={() => handleDelete(q.id)} className="p-4 text-slate-600 hover:text-red-500 hover:bg-red-500/10 rounded-2xl transition-all">
                  <Trash2 size={24} />
                </button>
              )}
            </div>
          ))}
          {questions.length === 0 && (
            <div className="py-40 text-center space-y-6">
              <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto border border-white/5">
                <Loader2 className="text-slate-700" size={40} />
              </div>
              <p className="text-slate-600 font-black italic text-2xl uppercase tracking-tighter">Waiting for questions...</p>
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