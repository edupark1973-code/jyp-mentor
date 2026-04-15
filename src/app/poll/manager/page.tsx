'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { useAuthStore } from '@/store/useAuthStore';
import { Plus, Trash2, X, BarChart3, QrCode, ChevronLeft, Loader2, Send, Vote } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

function PollManagerContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const lectureId = searchParams.get('id');
  const { user, role } = useAuthStore();
  
  const [polls, setPolls] = useState<any[]>([]);
  const [newQuestion, setNewQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [showQr, setShowQr] = useState<string | null>(null);

  // 해당 강좌 혹은 독립적으로 생성된 투표 목록 가져오기
  useEffect(() => {
    if (!lectureId) return;
    const q = query(
      collection(db, 'independent_polls'), 
      where('lectureId', '==', lectureId),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (s) => {
      setPolls(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [lectureId]);

  const addOption = () => setOptions([...options, '']);
  
  const createPoll = async () => {
    if (!newQuestion.trim() || options.filter(o => o.trim()).length < 2) {
      alert('질문과 최소 2개 이상의 선택지를 입력해주세요.');
      return;
    }

    await addDoc(collection(db, 'independent_polls'), {
      lectureId,
      question: newQuestion,
      options: options.filter(o => o.trim() !== ''),
      creator: user?.displayName || '강사',
      createdAt: serverTimestamp(),
      isActive: true
    });

    setNewQuestion('');
    setOptions(['', '']);
  };

  if (role !== 'admin') return <div className="p-10 text-center font-bold">권한이 없습니다.</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-8 text-slate-900">
      <div className="max-w-4xl mx-auto">
        <header className="flex justify-between items-center mb-12">
          <button onClick={() => window.close()} className="flex items-center gap-2 text-slate-500 font-bold hover:text-slate-800 transition-all">
            <ChevronLeft /> 창 닫기
          </button>
          <h1 className="text-3xl font-black flex items-center gap-3">
            <BarChart3 className="text-purple-600" size={32} /> 실시간 투표 관리 센터
          </h1>
          <div className="w-20" /> 
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* 왼쪽: 투표 생성 폼 */}
          <div className="md:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-purple-100">
              <h2 className="text-lg font-black mb-6 flex items-center gap-2 text-purple-600">
                <Plus size={20} /> 새 투표 생성
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">질문 내용</label>
                  <textarea 
                    value={newQuestion}
                    onChange={e => setNewQuestion(e.target.value)}
                    placeholder="예: 오늘 강의의 난이도는?"
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-purple-500 resize-none h-24 text-sm font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">선택지</label>
                  {options.map((opt, idx) => (
                    <input 
                      key={idx}
                      value={opt}
                      onChange={e => {
                        const newOpts = [...options];
                        newOpts[idx] = e.target.value;
                        setOptions(newOpts);
                      }}
                      placeholder={`옵션 ${idx + 1}`}
                      className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-purple-500 text-xs font-bold"
                    />
                  ))}
                  <button onClick={addOption} className="text-purple-600 text-[10px] font-black flex items-center gap-1 hover:underline">
                    + 선택지 추가하기
                  </button>
                </div>
                <button 
                  onClick={createPoll}
                  className="w-full py-4 bg-purple-600 text-white rounded-2xl font-black shadow-lg hover:bg-purple-700 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <Send size={18} /> 투표 시작하기
                </button>
              </div>
            </div>
          </div>

          {/* 오른쪽: 생성된 투표 목록 */}
          <div className="md:col-span-2 space-y-4">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest px-2 mb-4">현재 진행 중인 투표 리스트</h2>
            {polls.length === 0 && (
              <div className="bg-white/50 border-2 border-dashed border-slate-200 rounded-[2.5rem] py-20 text-center text-slate-400 font-bold">
                생성된 투표가 없습니다.
              </div>
            )}
            {polls.map((poll) => (
              <div key={poll.id} className="bg-white p-6 rounded-[2.5rem] shadow-md border border-slate-100 flex justify-between items-center group">
                <div className="flex-1">
                  <h3 className="font-black text-slate-800 mb-1">{poll.question}</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                    {poll.options.length}개의 선택지 • {poll.createdAt?.toDate().toLocaleTimeString()} 생성
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setShowQr(poll.id)}
                    className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-purple-50 hover:text-purple-600 transition-all"
                    title="QR 코드 보기"
                  >
                    <QrCode size={20} />
                  </button>
                  <button 
                    onClick={() => window.open(`/poll/live?id=${poll.id}`, '_blank')}
                    className="p-3 bg-indigo-50 text-indigo-400 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all"
                    title="실시간 결과창"
                  >
                    <BarChart3 size={20} />
                  </button>
                  <button 
                    onClick={() => deleteDoc(doc(db, 'independent_polls', poll.id))}
                    className="p-3 bg-red-50 text-red-300 rounded-2xl hover:bg-red-500 hover:text-white transition-all"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* QR 코드 모달 */}
        {showQr && (
          <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-6" onClick={() => setShowQr(null)}>
            <div className="bg-white p-10 rounded-[3rem] shadow-2xl flex flex-col items-center gap-8 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
              <div className="text-center">
                <h2 className="text-2xl font-black text-slate-900 mb-2">투표 참여 QR</h2>
                <p className="text-slate-500 font-medium">참여자들이 스캔하여 응답할 수 있습니다.</p>
              </div>
              <div className="p-6 bg-slate-50 rounded-[2rem] border-4 border-slate-100">
                <QRCodeSVG value={`${window.location.origin}/poll/vote?id=${lectureId}&pollId=${showQr}`} size={250} level="H" />
              </div>
              <button onClick={() => setShowQr(null)} className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black shadow-xl">닫기</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PollManagerPage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-purple-600" size={48} /></div>}>
      <PollManagerContent />
    </Suspense>
  );
}