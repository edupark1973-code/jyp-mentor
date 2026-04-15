'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Vote, Loader2, CheckCircle2, ChevronLeft } from 'lucide-react';
import Link from 'next/link';

function VoteContent() {
  const searchParams = useSearchParams();
  const lectureId = searchParams.get('id');
  const pollId = searchParams.get('pollId');
  const [polls, setPolls] = useState<any[]>([]);
  const [votedIds, setVotedIds] = useState<string[]>([]);

  useEffect(() => {
    if (!lectureId) return;
    
    // independent_polls 컬렉션에서 데이터 가져오기
    const q = query(collection(db, 'independent_polls'), where('lectureId', '==', lectureId));
    
    const unsub = onSnapshot(q, (s) => {
      const allPolls = s.docs.map(d => ({ id: d.id, ...d.data() }));
      setPolls(allPolls);
    }, (error) => {
      console.error("데이터 불러오기 에러:", error);
    });
    
    const saved = localStorage.getItem(`voted_${lectureId}`);
    if (saved) setVotedIds(JSON.parse(saved));

    return () => unsub();
  }, [lectureId]);

  const displayPolls = pollId ? polls.filter(p => p.id === pollId) : polls;

  const handleVote = async (pollId: string, optionIndex: number) => {
    if (votedIds.includes(pollId)) return;

    try {
      const pollRef = doc(db, 'independent_polls', pollId);
      const pollSnap = await getDoc(pollRef);
      if (!pollSnap.exists()) return;

      let currentOptions = pollSnap.data().options || [];

      // [핵심 수정 1] 데이터베이스에 단순 문자열로 저장되어 있다면 객체 형태로 안전하게 변환
      if (currentOptions.length > 0 && typeof currentOptions[0] === 'string') {
        currentOptions = currentOptions.map((text: string) => ({ text, votes: 0 }));
      }

      // 투표수 증가
      currentOptions[optionIndex].votes = (currentOptions[optionIndex].votes || 0) + 1;

      await updateDoc(pollRef, { options: currentOptions });
      
      const newVoted = [...votedIds, pollId];
      setVotedIds(newVoted);
      localStorage.setItem(`voted_${lectureId}`, JSON.stringify(newVoted));
    } catch (e) {
      console.error("투표 처리 중 에러:", e);
      alert('투표 처리 중 오류가 발생했습니다.');
    }
  };

  if (!lectureId) return <div className="p-10 text-center text-slate-500 font-bold">강의 정보가 없습니다.</div>;

  return (
    <div className="min-h-screen bg-[#f8fafc] p-5 text-slate-900">
      <div className="max-w-md mx-auto">
        <header className="flex items-center gap-4 mb-8">
          <Link href={`/lecture/live?id=${lectureId}`} className="p-2 bg-white rounded-full shadow-sm hover:bg-slate-50 transition-colors">
            <ChevronLeft size={20} />
          </Link>
          <h1 className="text-xl font-black flex items-center gap-2">
            <Vote className="text-blue-600" size={24} /> 실시간 투표
          </h1>
        </header>

        <div className="space-y-4">
          {displayPolls.length > 0 ? (
            displayPolls.map((poll) => (
              <div key={poll.id} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                <p className="font-bold text-lg mb-4">{poll.question}</p>
                <div className="grid gap-2">
                  {poll.options.map((opt: any, idx: number) => {
                    // [핵심 수정 2] 항목이 단순 단어인지 객체인지 파악하여 글씨를 제대로 뽑아냄
                    const optionText = typeof opt === 'string' ? opt : opt.text;

                    return (
                      <button
                        key={idx}
                        onClick={() => handleVote(poll.id, idx)}
                        disabled={votedIds.includes(poll.id)}
                        className={`w-full p-4 rounded-2xl text-left font-bold transition-all border-2 ${
                          votedIds.includes(poll.id)
                          ? 'bg-slate-50 border-transparent text-slate-400'
                          : 'border-slate-50 hover:border-blue-500 bg-white shadow-sm'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span>{optionText}</span>
                          {votedIds.includes(poll.id) && <CheckCircle2 size={18} className="text-blue-500" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-20">
              <Vote size={40} className="mx-auto mb-4 text-slate-200" />
              <p className="text-slate-400 font-bold">진행 중인 투표가 없습니다.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VotePage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={40} /></div>}>
      <VoteContent />
    </Suspense>
  );
}