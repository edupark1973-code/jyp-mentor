'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { collection, query, where, onSnapshot, doc, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { BarChart3, Loader2, Users, QrCode, ChevronLeft, ListFilter, CheckCircle2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

function PollLiveContent() {
  const searchParams = useSearchParams();
  const pollIdFromParams = searchParams.get('id');
  const lectureIdFromParams = searchParams.get('lectureId');
  
  const [allPolls, setAllPolls] = useState<any[]>([]);
  const [selectedPoll, setSelectedPoll] = useState<any>(null);
  const [votes, setVotes] = useState<any[]>([]);
  const [origin, setOrigin] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  // 1. 해당 강좌의 모든 투표 목록 가져오기
  useEffect(() => {
    if (!lectureIdFromParams && !pollIdFromParams) {
      setLoading(false);
      return;
    }

    let q;
    if (lectureIdFromParams) {
      q = query(
        collection(db, 'independent_polls'),
        where('lectureId', '==', lectureIdFromParams),
        orderBy('createdAt', 'desc')
      );
    } else {
      // pollId만 있는 경우 해당 투표의 lectureId를 알아내기 위해 단일 쿼리 후 전체 쿼리 필요할 수 있음
      // 여기서는 일단 해당 poll 하나만 가져오는 것으로 시작
      setLoading(true);
      const unsubSingle = onSnapshot(doc(db, 'independent_polls', pollIdFromParams!), (s) => {
        if (s.exists()) {
          const pollData = { id: s.id, ...s.data() };
          setAllPolls([pollData]);
          setSelectedPoll(pollData);
        }
        setLoading(false);
      });
      return () => unsubSingle();
    }

    const unsubAll = onSnapshot(q, (s) => {
      const polls = s.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllPolls(polls);
      
      // 처음 로드 시 선택된 투표 설정
      if (polls.length > 0) {
        if (pollIdFromParams) {
          const found = polls.find(p => p.id === pollIdFromParams);
          if (found) setSelectedPoll(found);
          else setSelectedPoll(polls[0]);
        } else {
          setSelectedPoll(polls[0]);
        }
      }
      setLoading(false);
    });

    return () => unsubAll();
  }, [lectureIdFromParams, pollIdFromParams]);

  // 2. 선택된 투표의 실시간 결과 감시
  useEffect(() => {
    if (!selectedPoll?.id) return;

    const q = query(collection(db, 'votes'), where('pollId', '==', selectedPoll.id));
    const unsubVotes = onSnapshot(q, (s) => {
      setVotes(s.docs.map(d => d.data()));
    });

    return () => unsubVotes();
  }, [selectedPoll?.id]);

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-900 text-white"><Loader2 className="animate-spin text-purple-500" size={40} /></div>;
  
  if (allPolls.length === 0) return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-900 text-white gap-4">
      <BarChart3 size={48} className="text-slate-700" />
      <p className="text-xl font-bold text-slate-500">진행 중인 투표가 없습니다.</p>
    </div>
  );

  // 전체 투표수 계산
  const totalVotes = selectedPoll?.options.reduce((sum: number, opt: any) => {
    const optVotes = typeof opt === 'object' && typeof opt.votes === 'number' ? opt.votes : 0;
    return sum + optVotes;
  }, votes.length) || 0;

  return (
    <div className="min-h-screen bg-slate-900 text-white flex relative overflow-hidden">
      {/* 뒤로가기 버튼 */}
      <button 
        onClick={() => window.close()} 
        className="absolute top-6 left-6 p-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 text-white transition-all z-50 shadow-lg backdrop-blur-md"
        title="닫기"
      >
        <ChevronLeft size={24} />
      </button>

      {/* 왼쪽: 투표 목록 사이드바 (여러 투표가 있을 때만 유용) */}
      <aside className="w-80 border-r border-white/10 bg-slate-900/50 backdrop-blur-xl p-8 pt-24 overflow-y-auto hidden xl:block">
        <div className="flex items-center gap-2 mb-8 text-slate-400">
          <ListFilter size={18} />
          <span className="text-xs font-black uppercase tracking-widest">진행 중인 투표 목록</span>
        </div>
        <div className="space-y-3">
          {allPolls.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedPoll(p)}
              className={`w-full p-5 rounded-2xl text-left transition-all border-2 flex flex-col gap-2 ${
                selectedPoll?.id === p.id
                ? 'border-purple-500 bg-purple-500/10 shadow-[0_0_20px_rgba(168,85,247,0.1)]'
                : 'border-white/5 bg-white/5 hover:border-white/20 text-slate-400'
              }`}
            >
              <span className={`text-sm font-bold leading-snug ${selectedPoll?.id === p.id ? 'text-white' : ''}`}>
                {p.question}
              </span>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] font-black uppercase opacity-50">{p.options.length} OPTIONS</span>
                {selectedPoll?.id === p.id && <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse" />}
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* 메인 콘텐츠 영역 */}
      <main className="flex-1 p-8 lg:p-12 flex items-center justify-center overflow-y-auto">
        <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* 모바일/태블릿용 투표 선택 (작은 화면) */}
          <div className="lg:hidden col-span-full mb-4">
             <select 
               value={selectedPoll?.id} 
               onChange={(e) => setSelectedPoll(allPolls.find(p => p.id === e.target.value))}
               className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl font-bold outline-none"
             >
               {allPolls.map(p => <option key={p.id} value={p.id} className="bg-slate-900">{p.question}</option>)}
             </select>
          </div>

          {/* 왼쪽: QR 코드 섹션 */}
          <div className="lg:col-span-5 flex flex-col items-center gap-8 bg-white/5 p-10 rounded-[3rem] border border-white/10 backdrop-blur-sm">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-black flex items-center justify-center gap-2">
                <QrCode className="text-purple-400" /> 투표 참여하기
              </h2>
              <p className="text-slate-400 font-bold text-sm">스마트폰으로 스캔하세요</p>
            </div>
            <div className="p-6 bg-white rounded-[2.5rem] shadow-[0_0_50px_rgba(168,85,247,0.2)]">
              {origin && selectedPoll && (
                <QRCodeSVG 
                  value={`${origin}/poll/vote?id=${selectedPoll.lectureId}&pollId=${selectedPoll.id}`} 
                  size={280} 
                  level="H"
                  includeMargin={false}
                />
              )}
            </div>
            <div className="text-center">
              <p className="text-purple-400 font-black text-xs uppercase tracking-widest">Real-time Feedback</p>
            </div>
          </div>

          {/* 오른쪽: 결과 섹션 */}
          <div className="lg:col-span-7 space-y-10">
            <header className="space-y-4">
              <div className="inline-flex items-center gap-3 px-6 py-2 bg-purple-500/20 text-purple-400 rounded-full border border-purple-500/30 text-sm font-black uppercase tracking-widest">
                <BarChart3 size={18} /> Live Real-time Poll
              </div>
              <h1 className="text-4xl lg:text-5xl font-black leading-tight tracking-tight">
                {selectedPoll?.question}
              </h1>
              <div className="flex items-center gap-2 text-slate-400 font-bold text-lg">
                <Users size={24} /> 현재 {totalVotes}명 참여 중
              </div>
            </header>

            <div className="space-y-6">
              {selectedPoll?.options.map((option: any, idx: number) => {
                const optionText = typeof option === 'string' ? option : option.text;
                const countFromCollection = votes.filter(v => v.optionIndex === idx).length;
                const countFromOption = typeof option === 'object' && typeof option.votes === 'number' ? option.votes : 0;
                const count = countFromCollection + countFromOption;
                const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;

                return (
                  <div key={idx} className="relative group">
                    <div className="flex justify-between mb-3 px-2">
                      <span className="text-xl font-black">{optionText}</span>
                      <span className="text-xl font-black text-purple-400">{percent}% ({count}표)</span>
                    </div>
                    <div className="w-full h-16 bg-white/5 rounded-2xl overflow-hidden border border-white/10 p-2">
                      <div 
                        className="h-full bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl transition-all duration-1000 ease-out shadow-[0_0_20px_rgba(147,51,234,0.3)]"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

export default function PollLivePage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center bg-slate-900 text-white"><Loader2 className="animate-spin text-purple-500" size={40} /></div>}>
      <PollLiveContent />
    </Suspense>
  );
}
