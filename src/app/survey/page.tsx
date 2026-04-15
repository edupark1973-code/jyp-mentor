'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { doc, getDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { CheckCircle2, Loader2, Award } from 'lucide-react';

function SurveyContent() {
  const searchParams = useSearchParams();
  const cardId = searchParams.get('id');
  
  const [card, setCard] = useState<any>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (cardId) {
      getDoc(doc(db, 'cards', cardId)).then(s => {
        if (s.exists()) setCard({ id: s.id, ...s.data() });
        setLoading(false);
      });
    }
  }, [cardId]);

  const handleSubmit = async () => {
    if (selectedOption === null || !cardId) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'votes'), {
        cardId,
        optionIndex: selectedOption,
        createdAt: serverTimestamp(),
      });
      setIsSubmitted(true);
    } catch (e) {
      alert('투표 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !card) return <div className="flex min-h-screen items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-blue-500" size={40} /></div>;
  if (!card || card.type !== 'poll') return <div className="p-10 text-center">유효하지 않은 설문입니다.</div>;

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6 animate-bounce">
          <CheckCircle2 size={40} />
        </div>
        <h1 className="text-2xl font-black text-slate-900 mb-2">투표 완료!</h1>
        <p className="text-slate-500 font-medium">참여해 주셔서 감사합니다.<br/>결과는 실시간 보드에 반영됩니다.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center">
      <div className="w-full max-w-md bg-white rounded-[2rem] shadow-2xl overflow-hidden mt-10 border border-slate-100">
        <div className="p-8 bg-indigo-600 text-white text-center">
          <Award className="mx-auto mb-4 opacity-50" size={32} />
          <h1 className="text-xl font-black leading-tight">{card.title}</h1>
          <p className="text-indigo-200 text-xs mt-2 font-bold uppercase tracking-widest">Live Interactive Poll</p>
        </div>
        
        <div className="p-8 space-y-4">
          <p className="text-slate-600 text-sm font-medium mb-6 text-center">{card.content}</p>
          
          <div className="space-y-3">
            {card.options?.map((opt: string, idx: number) => (
              <button
                key={idx}
                onClick={() => setSelectedOption(idx)}
                className={`w-full p-5 rounded-2xl border-2 text-left font-bold transition-all flex justify-between items-center ${
                  selectedOption === idx 
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-4 ring-indigo-50' 
                    : 'border-slate-100 bg-white text-slate-600 hover:border-indigo-200'
                }`}
              >
                <span>{opt}</span>
                {selectedOption === idx && <CheckCircle2 size={20} />}
              </button>
            ))}
          </div>

          <button
            onClick={handleSubmit}
            disabled={selectedOption === null || loading}
            className="w-full mt-8 py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl hover:bg-black disabled:opacity-30 transition-all active:scale-95 flex justify-center items-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : '투표 제출하기'}
          </button>
        </div>
      </div>
      <p className="mt-10 text-[10px] text-slate-400 font-black uppercase tracking-[0.3em]">EduFiles Live Poll System</p>
    </div>
  );
}

export default function SurveyPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-slate-400">Loading Poll...</div>}>
      <SurveyContent />
    </Suspense>
  );
}
