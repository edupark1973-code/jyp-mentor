'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { BarChart3, Video } from 'lucide-react';

// 임시 강좌 데이터 타입 (강사님의 프로젝트 구조에 맞게 연동되어 있을 것입니다)
interface Lecture {
  id: string;
  title: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { role } = useAuthStore();

  // 테스트용 임시 데이터 (실제 데이터 연동 부에 맞춰 적용하세요)
  const lecture: Lecture = { id: 'sample-lecture-id', title: '웹 프로그래밍 실습' };

  const handlePollClick = () => {
    if (!lecture.id) return;
    
    if (role === 'admin') {
      // 👑 강사님은 투표 출제 및 제어를 위해 관리자 창으로 이동 (새 탭)
      window.open(`/poll/manager?id=${lecture.id}`, '_blank');
    } else {
      // 🧑‍🎓 수강생은 목록을 거치지 않고 실시간 결과/참여(Live) 창으로 직행 (새 탭)
      window.open(`/poll/live?lectureId=${lecture.id}`, '_blank');
    }
  };

  const handleLiveClick = () => {
    if (!lecture.id) return;
    window.open(`/lecture/live?id=${lecture.id}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8 text-slate-900 flex flex-col items-center justify-center gap-6">
      <div className="bg-white p-8 rounded-3xl shadow-md max-w-md w-full border border-slate-100 text-center space-y-6">
        <h1 className="text-2xl font-black tracking-tight">{lecture.title}</h1>
        <p className="text-slate-500 font-medium text-sm">현재 활성화된 강의 세션입니다.</p>
        
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={handlePollClick}
            className="flex flex-col items-center justify-center p-6 bg-blue-50 hover:bg-blue-100/80 text-blue-600 rounded-2xl border border-blue-100 font-bold gap-2 transition-all shadow-sm"
          >
            <BarChart3 size={28} />
            <span>실시간 투표</span>
          </button>

          <button
            onClick={handleLiveClick}
            className="flex flex-col items-center justify-center p-6 bg-indigo-50 hover:bg-indigo-100/80 text-indigo-600 rounded-2xl border border-indigo-100 font-bold gap-2 transition-all shadow-sm"
          >
            <Video size={28} />
            <span>라이브 Q&A</span>
          </button>
        </div>
      </div>
    </div>
  );
}