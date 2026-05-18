'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { BarChart3, Loader2, ChevronLeft, Vote, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

function PollLiveContent() {
  const searchParams = useSearchParams();
  const lectureId = searchParams.get('lectureId');
  const [polls, setPolls] = useState<any[]>([]);
  const [selectedPoll, setSelectedPoll] = useState<any>(null);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!lectureId) return;
    const q = query(collection(db, 'independent_polls'), where('lectureId', '==', lectureId));
    const unsub = onSnapshot(q, (s) => {
      const allPolls = s.docs.map(d => ({ id: d.id, ...d.data() }));
      setPolls(allPolls);
      
      // 🌟 [에러 수정 부분] p를 any 타입으로 지정하여 status 속성 검사 에러를 해결했습니다.
      if (allPolls.length > 0) {
        const active = allPolls.find((p: any) => p.status === 'active') || allPolls[0];
        setSelectedPoll(active);
      }
    });
    return () => unsub();
  }, [lectureId]);

  if (!lectureId) return <div className="p-10 text-center">강의 ID가 없습니다.</div>;

  // 총 투표수 계산
  const totalVotes = selectedPoll?.options?.reduce((acc: number, cur: any) => acc + (cur.votes || 0), 0) || 0;

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-900 text-white relative">
      
      {/* 좌측 상단: 창 닫기 버튼 */}
      <button 
        onClick={() => window.close()} 
        className="fixed top-4 left-4 md:top-8 md:left-8 p-3 bg-white hover:bg-slate-50 rounded-2xl border border-slate-200 text-slate-900 transition-all z-50 shadow-lg flex items-center gap-2 font-bold text-sm"
        title="창 닫기"
      >
        <ChevronLeft size={20} /> 창 닫기
      </button>

      {/* 왼쪽 사이드바: 투표 목록 및 QR 정보 */}
      <div className="w-full lg:w-1/3 lg:h-screen lg:border-r border-white/10 p-6 md:p-12 flex flex-col justify-between bg-slate-900/50 backdrop-blur-xl shrink-0 box-border overflow-y-auto custom-scrollbar pt-20 md:pt-28">
        
        {/* 복수 투표 진행 시 목록 전환 처리 */}
        <div className="space-y-4 mb-8">
          <h2 className="text-xs font-black tracking-widest text-slate-500 uppercase">진행 중인 투표 목록</h2>
          <div className="space-y-2">
            {polls.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedPoll(p)}
                className={`w-full p-4 rounded-xl text-left font-bold border transition-all text-sm truncate block ${
                  selectedPoll?.id === p.id
                    ? 'bg-blue-600 border-blue-500 text-white shadow-md'
                    : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'
                }`}
              >
                {p.question}
              </button>
            ))}
            {polls.length === 0 && <p className="text-slate-600 text-sm font-bold">진행 중인 투표가 없습니다.</p>}
          </div>
        </div>

        {/* QR 코드 영역 */}
        {selectedPoll && (
          <div className="flex flex-col items-center text-center border-t border-white/5 pt-6">
            <div className="p-4 bg-white rounded-[2rem] shadow-lg border-4 border-white/5 mb-4">
              {origin && (
                <div className="w-[140px] h-[140px] md:w-[180px] md:h-[180px]">
                  <QRCodeSVG value={`${origin}/poll/vote?id=${lectureId}&pollId=${selectedPoll.id}`} size={undefined} className="w-full h-full" />
                </div>
              )}
            </div>
            
            {/* 참여 버튼 */}
            <button
              onClick={() => window.open(`/poll/vote?id=${lectureId}&pollId=${selectedPoll.id}`, '_blank')}
              className="w-full max-w-[220px] py-3 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white rounded-xl font-black text-sm shadow-md flex items-center justify-center gap-2 transition-all mb-4"
            >
              <Vote size={16} /> 🗳️ 이 투표에 참여하기
            </button>

            <p className="text-slate-500 font-bold text-[10px] md:text-xs uppercase tracking-widest flex items-center gap-1">
              <QrCode size={12} /> Scan or Tap to Vote
            </p>
          </div>
        )}
      </div>

      {/* 오른쪽 메인 콘텐츠: 투표 실시간 통계 결과 */}
      <div className="w-full lg:w-2/3 lg:h-screen bg-slate-900/30 p-6 md:p-16 overflow-y-auto custom-scrollbar flex flex-col justify-center">
        {selectedPoll ? (
          <div className="w-full max-w-3xl mx-auto space-y-8 md:space-y-12">
            <header className="space-y-3">
              <div className="px-4 py-1 bg-blue-600/20 text-blue-400 rounded-full border border-blue-500/30 font-black text-[10px] md:text-xs tracking-widest inline-flex items-center gap-1.5 uppercase">
                <BarChart3 size={12} /> LIVE STATISTICS
              </div>
              <h1 className="text-2xl md:text-4xl font-black tracking-tight leading-tight">{selectedPoll.question}</h1>
              <p className="text-slate-500 font-bold text-xs md:text-sm">현재까지 총 {totalVotes}명이 참여했습니다.</p>
            </header>

            <div className="space-y-4 md:space-y-6">
              {selectedPoll.options?.map((opt: any, idx: number) => {
                const optionText = typeof opt === 'string' ? opt : opt.text;
                const votes = typeof opt === 'string' ? 0 : opt.votes || 0;
                const percent = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;

                return (
                  <div key={idx} className="space-y-2 group">
                    <div className="flex justify-between font-bold text-sm md:text-lg">
                      <span className="text-slate-300 group-hover:text-white transition-colors">{optionText}</span>
                      <span className="text-blue-400 font-black">{votes}표 ({percent}%)</span>
                    </div>
                    <div className="h-4 md:h-6 bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/5">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="text-center space-y-4">
            <Loader2 className="animate-spin text-slate-700 w-10 h-10 mx-auto" />
            <p className="text-slate-500 font-black tracking-tighter uppercase text-xl">통계를 준비 중입니다...</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PollLivePage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>}>
      <PollLiveContent />
    </Suspense>
  );
}