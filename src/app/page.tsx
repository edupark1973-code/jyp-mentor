'use client';

import { Suspense, useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, where, getDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, auth } from '@/lib/firebase';
import { useAuthStore } from '@/store/useAuthStore';
import { Plus, FileText, Link as LinkIcon, Download, Trash2, X, Send, Loader2, ArrowRight, ExternalLink, MessageCircle, Paperclip, LayoutGrid, BookOpen, ChevronLeft, Calendar, BarChart3, Maximize2, Vote, Copy, Check, Globe, Lock, Pin, ChevronUp, ChevronDown, Pencil } from 'lucide-react';

// --- 유틸리티: 이미지 압축 ---
const compressImage = (file: File): Promise<Blob | File> => {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) { resolve(file); return; }
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width; let height = img.height;
        const max_size = 1200;
        if (width > height) { if (width > max_size) { height *= max_size / width; width = max_size; } }
        else { if (height > max_size) { width *= max_size / height; height = max_size; } }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => { resolve(blob || file); }, 'image/jpeg', 0.7);
      };
    };
  });
};

// --- 유틸리티: 보안 이미지 URL 전환 ---
const getSecureUrl = (url: string) => {
  if (!url) return url;
  if (url.startsWith('http://k.kakaocdn.net')) {
    return url.replace('http://', 'https://');
  }
  return url;
};

// --- 컴포넌트: 링크 미리보기 ---
function LinkPreview({ url }: { url: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}`)
      .then(res => res.json())
      .then(json => {
        if (json.status === 'success') setData(json.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [url]);

  if (loading) return <div className="h-24 bg-slate-50 animate-pulse rounded-2xl border border-slate-100 w-full"></div>;
  
  if (!data || !data.title) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50 hover:bg-blue-100 transition-all text-blue-600 font-black text-xs uppercase tracking-widest">
        <LinkIcon size={16} />
        <span className="flex-1 truncate">{url}</span>
        <ExternalLink size={14} />
      </a>
    );
  }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block border border-slate-100 rounded-2xl overflow-hidden hover:shadow-lg transition-all group bg-slate-50 cursor-pointer">
      {data.image?.url && (
        <div className="h-32 w-full overflow-hidden border-b border-slate-100/50">
          <img src={getSecureUrl(data.image.url)} alt="thumbnail" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        </div>
      )}
      <div className="p-4 bg-white">
        <h4 className="font-black text-sm text-slate-900 truncate mb-1">{data.title}</h4>
        <p className="text-xs text-slate-500 line-clamp-2 mb-2 leading-relaxed font-bold">{data.description}</p>
        <div className="flex items-center gap-1.5 text-blue-500 text-[10px] font-black uppercase tracking-widest">
          <LinkIcon size={12} /> {new URL(url).hostname}
        </div>
      </div>
    </a>
  );
}

// --- 메인 대시보드 (쇼윈도 & 작업실) ---
function HomeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const lectureId = searchParams.get('id');
  const { role, user, loading: authLoading } = useAuthStore();
  
  const [lectures, setLectures] = useState<any[]>([]);
  const [currentLecture, setCurrentLecture] = useState<any>(null);
  const [isAddingLecture, setIsAddingLecture] = useState(false);
  const [newLectureTitle, setNewLectureTitle] = useState('');
  const [newLectureDesc, setNewLectureDesc] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [allowStudentPosts, setAllowStudentPosts] = useState(false);
  
  // 강사일 때 '내 작업실'을 볼지 '전체 쇼윈도'를 볼지 결정
  const [viewMode, setViewMode] = useState<'workspace' | 'public'>('workspace');

  useEffect(() => {
    const q = query(collection(db, 'lectures'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (s) => setLectures(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (lectureId) {
      getDoc(doc(db, 'lectures', lectureId)).then(s => {
        if (s.exists()) setCurrentLecture({ id: s.id, ...s.data() });
        else router.push('/');
      });
    } else {
      setCurrentLecture(null);
    }
  }, [lectureId, router]);

  const addLecture = async () => {
    if (!newLectureTitle.trim()) return;
    await addDoc(collection(db, 'lectures'), {
      title: newLectureTitle,
      description: newLectureDesc,
      instructor: user?.displayName || '공용 강사',
      instructorUid: user?.uid || 'unknown',
      isPublic: isPublic,
      allowStudentPosts: allowStudentPosts,
      createdAt: serverTimestamp(),
    });
    setNewLectureTitle(''); setNewLectureDesc(''); setIsAddingLecture(false); setIsPublic(true); setAllowStudentPosts(false);
  };

  if (authLoading) return <div className="h-screen flex items-center justify-center bg-slate-900"><Loader2 className="animate-spin text-blue-600 w-12 h-12" /></div>;

  if (lectureId && currentLecture) {
    return <Board lecture={currentLecture} role={role} onBack={() => router.push('/')} />;
  }

  // 필터링: 강사의 작업실 모드면 내 것만, 아니면 전체 공개 강좌만
  const displayLectures = role === 'admin' && user && viewMode === 'workspace'
    ? lectures.filter(lecture => lecture.instructorUid === user.uid)
    : lectures.filter(lecture => lecture.isPublic !== false); 

  return (
    <div className="min-h-screen bg-slate-900 p-8 text-white font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-[1.5rem] flex items-center justify-center text-white shadow-2xl shadow-blue-500/20">
              <BookOpen size={32} />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-white italic">EduReport</h1>
              <p className="text-slate-500 text-xs font-black uppercase tracking-[0.3em] mt-1">
                {role === 'admin' && user && viewMode === 'workspace' ? `${user.displayName || '강사'}'s Workspace` : 'Public Courses'}
              </p>
            </div>
          </div>
          {role === 'admin' && (
            <button onClick={() => setIsAddingLecture(true)} className="px-8 py-4 bg-blue-600 text-white rounded-[1.25rem] font-black flex items-center gap-2 shadow-xl shadow-blue-500/20 hover:bg-blue-500 transition-all active:scale-95">
              <Plus size={20} /> 새 강좌 생성
            </button>
          )}
        </header>

        {/* 강사용 탭 스위치 */}
        {role === 'admin' && user && (
          <div className="flex bg-white/5 p-1.5 rounded-2xl border border-white/10 mb-10 w-fit backdrop-blur-sm">
            <button onClick={() => setViewMode('workspace')} className={`px-6 py-2.5 rounded-xl font-black text-sm transition-all flex items-center gap-2 ${viewMode === 'workspace' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>
              <LayoutGrid size={16} /> 내 작업실
            </button>
            <button onClick={() => setViewMode('public')} className={`px-6 py-2.5 rounded-xl font-black text-sm transition-all flex items-center gap-2 ${viewMode === 'public' ? 'bg-white text-slate-900 shadow-lg' : 'text-slate-400 hover:text-white'}`}>
              <Globe size={16} /> 공개 쇼윈도 구경하기
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {displayLectures.map((lecture) => (
            <div key={lecture.id} onClick={() => router.push(`/?id=${lecture.id}`)} className="bg-white/5 p-10 rounded-[3.5rem] border border-white/10 shadow-sm hover:shadow-2xl hover:border-blue-500/50 hover:-translate-y-2 transition-all cursor-pointer group relative overflow-hidden backdrop-blur-sm flex flex-col h-[320px]">
              {role === 'admin' && lecture.instructorUid === user?.uid && (
                <button onClick={(e) => { e.stopPropagation(); if(confirm('삭제하시겠습니까? (첨부파일은 Storage에서 별도 삭제가 필요할 수 있습니다)')) deleteDoc(doc(db, 'lectures', lecture.id)); }} className="absolute top-8 right-8 p-2 text-slate-600 hover:text-red-500 rounded-xl transition-colors z-10"><Trash2 size={20} /></button>
              )}
              
              <div className="flex items-center justify-between mb-8">
                <div className="w-16 h-16 bg-white/5 rounded-[1.5rem] flex items-center justify-center text-slate-500 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-inner border border-white/5"><LayoutGrid size={32} /></div>
                {role === 'admin' && (
                  <div className={`px-3 py-1.5 rounded-full text-[10px] font-black flex items-center gap-1.5 uppercase tracking-widest ${lecture.isPublic !== false ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                    {lecture.isPublic !== false ? <><Globe size={12}/> Public</> : <><Lock size={12}/> Private</>}
                  </div>
                )}
              </div>
              
              <h3 className="text-3xl font-black mb-4 leading-tight group-hover:text-white transition-colors line-clamp-2 flex-1">{lecture.title}</h3>
              
              {viewMode === 'public' && (
                <div className="text-slate-400 font-bold text-sm mb-4">👨‍🏫 {lecture.instructor}</div>
              )}
              
              <div className="flex items-center justify-between pt-6 border-t border-white/5 mt-auto">
                 <div className="flex items-center gap-2 text-slate-500 text-[10px] font-black uppercase tracking-widest"><Calendar size={14}/> {lecture.createdAt?.toDate().toLocaleDateString()}</div>
                 <div className="text-blue-500 font-black text-[10px] flex items-center gap-1.5 uppercase tracking-[0.2em] group-hover:text-blue-400 transition-colors">Enter Board <ArrowRight size={14}/></div>
              </div>
            </div>
          ))}
          
          {displayLectures.length === 0 && (
            <div className="col-span-full py-20 text-center text-slate-500 font-bold">
              {viewMode === 'workspace' ? '아직 개설된 강좌가 없습니다. 새 강좌를 생성해 보세요!' : '현재 공개된 강좌가 없습니다.'}
            </div>
          )}
        </div>

        {/* 새 강좌 생성 모달 */}
        {isAddingLecture && (
          <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-6" onClick={() => setIsAddingLecture(false)}>
            <div className="bg-white rounded-[3rem] p-12 w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
              <h2 className="text-3xl font-black mb-8 text-slate-900">새 강좌 생성</h2>
              <div className="space-y-5">
                <input value={newLectureTitle} onChange={e => setNewLectureTitle(e.target.value)} placeholder="강좌명" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-[1.5rem] outline-none font-black text-lg text-slate-900" />
                <textarea value={newLectureDesc} onChange={e => setNewLectureDesc(e.target.value)} placeholder="과정 설명" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-[1.5rem] h-32 outline-none resize-none font-bold text-slate-900" />
                
                <div className={`p-5 rounded-[1.5rem] border-2 cursor-pointer transition-all flex items-center justify-between ${isPublic ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 bg-slate-50'}`} onClick={() => setIsPublic(!isPublic)}>
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${isPublic ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-500'}`}>
                      {isPublic ? <Globe size={20} /> : <Lock size={20} />}
                    </div>
                    <div>
                      <p className={`font-black ${isPublic ? 'text-blue-900' : 'text-slate-600'}`}>{isPublic ? '메인 페이지에 공개' : '링크로만 접속 (비공개)'}</p>
                      <p className="text-xs text-slate-500 font-bold mt-1">
                        {isPublic ? '누구나 메인 화면에서 이 강좌를 볼 수 있습니다.' : '초대 링크를 받은 수강생만 접속할 수 있습니다.'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className={`p-5 rounded-[1.5rem] border-2 cursor-pointer transition-all flex items-center justify-between ${allowStudentPosts ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-200 bg-slate-50'}`} onClick={() => setAllowStudentPosts(!allowStudentPosts)}>
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${allowStudentPosts ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-500'}`}>
                      <Plus size={20} />
                    </div>
                    <div>
                      <p className={`font-black ${allowStudentPosts ? 'text-indigo-900' : 'text-slate-600'}`}>{allowStudentPosts ? '수강생 카드 업로드 허용' : '강사만 업로드 가능'}</p>
                      <p className="text-xs text-slate-500 font-bold mt-1">
                        {allowStudentPosts ? '로그인한 모든 사용자가 보드에 카드를 올릴 수 있습니다.' : '강사 계정으로 로그인한 유저만 카드를 생성할 수 있습니다.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 mt-10">
                <button onClick={addLecture} className="flex-1 bg-blue-600 text-white py-5 rounded-[1.5rem] font-black shadow-xl">생성하기</button>
                <button onClick={() => setIsAddingLecture(false)} className="px-8 bg-slate-100 text-slate-500 py-5 rounded-[1.5rem] font-black">취소</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- 강의실(보드) 화면 ---
function Board({ lecture, role, onBack }: any) {
  const [sections, setSections] = useState<any[]>([]);
  const [cards, setCards] = useState<any[]>([]);
  const [isAddingSection, setIsAddingSection] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [previewMedia, setPreviewMedia] = useState<{url: string, type: string} | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPublic, setIsPublic] = useState(lecture.isPublic !== false);
  const [allowStudentPosts, setAllowStudentPosts] = useState(!!lecture.allowStudentPosts);

  useEffect(() => {
    const sq = query(collection(db, 'sections'), where('lectureId', '==', lecture.id));
    const unsubS = onSnapshot(sq, (s) => setSections(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0))));
    const cq = query(collection(db, 'cards'), where('lectureId', '==', lecture.id));
    const unsubC = onSnapshot(cq, (s) => {
      const fetchedCards = s.docs.map(d => ({ id: d.id, ...d.data() }));
      const sortedCards = fetchedCards.sort((a: any, b: any) => {
        if (a.isPinned !== b.isPinned) {
          return b.isPinned ? 1 : -1; // Correctly place pinned cards (b) before unpinned cards (a)
        }
        return (a.order || 0) - (b.order || 0);
      });
      setCards(sortedCards);
    });
    return () => { unsubS(); unsubC(); };
  }, [lecture.id]);

  const addSection = async () => {
    if (!newSectionTitle.trim()) return;
    await addDoc(collection(db, 'sections'), { lectureId: lecture.id, title: newSectionTitle, createdAt: serverTimestamp() });
    setNewSectionTitle(''); setIsAddingSection(false);
  };

  const updateLectureSettings = async () => {
    await updateDoc(doc(db, 'lectures', lecture.id), { isPublic, allowStudentPosts });
    setIsSettingsOpen(false);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-900 overflow-hidden text-slate-200">
      <header className="p-6 border-b border-white/10 flex justify-between items-center bg-slate-900/50 backdrop-blur-md z-10">
        <div className="flex items-center gap-6">
          <button onClick={onBack} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 text-white transition-all"><ChevronLeft /></button>
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-3 tracking-tight"><div className="w-2 h-6 bg-pink-500 rounded-full"></div> {lecture.title}</h1>
            <p className="text-slate-400 text-[10px] font-black uppercase mt-1 tracking-widest">{lecture.instructor} • BOARD</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 overflow-x-auto custom-scrollbar pb-1">
          {role === 'admin' && (
            <button onClick={() => setIsSettingsOpen(true)} className="px-5 py-2.5 bg-slate-800 text-white rounded-2xl font-black text-sm transition-all hover:bg-slate-700">강좌 설정</button>
          )}
          <button 
            onClick={() => {
              const inviteLink = `${window.location.origin}/?id=${lecture.id}`;
              navigator.clipboard.writeText(inviteLink);
              alert('수강생 초대 링크가 복사되었습니다!');
            }} 
            className="px-5 py-2.5 bg-slate-700 text-white rounded-2xl font-black text-sm flex items-center gap-2 transition-all shadow-lg hover:bg-slate-600 active:scale-95 whitespace-nowrap"
          >
            <LinkIcon size={18} /> 초대 링크 복사
          </button>
          <button onClick={() => window.open(`/lecture/live?id=${lecture.id}`, '_blank')} className="px-5 py-2.5 bg-indigo-600 text-white rounded-2xl font-black text-sm flex items-center gap-2 transition-all shadow-lg hover:bg-indigo-700 active:scale-95 whitespace-nowrap"><Maximize2 size={18} /> 라이브 모드</button>
          <button onClick={() => window.open(`/poll/live?lectureId=${lecture.id}`, '_blank')} className="px-5 py-2.5 bg-blue-600 text-white rounded-2xl font-black text-sm flex items-center gap-2 transition-all shadow-lg hover:bg-blue-700 active:scale-95 whitespace-nowrap"><Vote size={18} /> 투표 참여</button>
          {role === 'admin' && (
            <>
              <button onClick={() => window.open(`/poll/manager?id=${lecture.id}`, '_blank')} className="px-5 py-2.5 bg-purple-600 text-white rounded-2xl font-black text-sm flex items-center gap-2 shadow-lg hover:bg-purple-700 active:scale-95 whitespace-nowrap"><BarChart3 size={18} /> 투표 관리</button>
              <button onClick={() => setIsAddingSection(true)} className="px-5 py-2.5 bg-pink-500 text-white rounded-2xl font-black text-sm flex items-center gap-2 shadow-lg hover:bg-pink-600 active:scale-95 whitespace-nowrap"><Plus size={18} /> 섹션 추가</button>
            </>
          )}
        </div>
      </header>

      {/* 설정 모달 */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-6" onClick={() => setIsSettingsOpen(false)}>
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-sm text-slate-900" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-black mb-6">강좌 설정 수정</h2>
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={isPublic} onChange={() => setIsPublic(!isPublic)} className="w-5 h-5 accent-blue-600" />
                <span className="font-bold">메인 페이지 공개</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={allowStudentPosts} onChange={() => setAllowStudentPosts(!allowStudentPosts)} className="w-5 h-5 accent-indigo-600" />
                <span className="font-bold">수강생 카드 업로드 허용</span>
              </label>
            </div>
            <button onClick={updateLectureSettings} className="w-full mt-8 py-3 bg-blue-600 text-white rounded-xl font-black">저장</button>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-x-auto p-8 flex gap-8 items-start custom-scrollbar">
        {sections.map(section => (
          <Section key={section.id} section={section} lecture={lecture} cards={cards.filter(c => c.sectionId === section.id)} role={role} onPreview={setPreviewMedia} />
        ))}
        {isAddingSection && (
          <div className="w-80 flex-shrink-0 bg-white/10 rounded-[2rem] p-5 border border-white/10 backdrop-blur-xl animate-in fade-in">
             <input autoFocus value={newSectionTitle} onChange={e => setNewSectionTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && addSection()} placeholder="섹션 제목 입력..." className="w-full bg-white/10 border border-white/10 rounded-2xl px-5 py-3 text-white font-bold outline-none mb-4 focus:border-pink-500 transition-all" />
             <div className="flex gap-3">
               <button onClick={addSection} className="flex-1 bg-pink-500 text-white py-3 rounded-xl font-black text-sm shadow-lg active:scale-95 transition-all hover:bg-pink-600">생성</button>
               <button onClick={() => setIsAddingSection(false)} className="px-4 bg-white/5 text-slate-400 py-3 rounded-xl border border-white/5 hover:bg-white/10 transition-colors"><X/></button>
             </div>
          </div>
        )}
      </main>

      {/* PDF 및 이미지 모달 뷰어 */}
      {previewMedia && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-10 animate-in fade-in" onClick={() => setPreviewMedia(null)}>
            <div className="relative w-full max-w-5xl h-full flex flex-col items-center justify-center" onClick={e => e.stopPropagation()}>
              <div className="absolute -top-12 right-0 flex items-center gap-4">
                <a href={previewMedia.url} target="_blank" rel="noopener noreferrer" download className="p-2 text-white/50 hover:text-white transition-colors" title="원본 파일 다운로드" onClick={e => e.stopPropagation()}>
                  <Download size={28} />
                </a>
                <button onClick={() => setPreviewMedia(null)} className="p-2 text-white/50 hover:text-white transition-colors" title="닫기">
                  <X size={32} />
                </button>
              </div>
              
              {previewMedia.type.startsWith('image/') ? (
                <img src={previewMedia.url} alt="Preview" className="max-w-full max-h-full object-contain rounded-xl shadow-2xl" />
              ) : previewMedia.type === 'application/pdf' ? (
                <iframe src={`https://docs.google.com/gview?url=${encodeURIComponent(previewMedia.url)}&embedded=true`} className="w-full h-full rounded-2xl bg-white shadow-2xl border-none" title="PDF 뷰어" />
              ) : (
                <div className="text-white font-bold">이 파일 형식은 웹 미리보기를 지원하지 않습니다.</div>
              )}
            </div>
        </div>
      )}
    </div>
  );
}

// --- 섹션 (리스트) ---
function Section({ section, lecture, cards, role, onPreview }: any) {
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [fileData, setFileData] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { user } = useAuthStore();

  const handleFileUpload = async (e: any) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // 파일 용량 10MB 제한 로직 (선택적 방어)
    if (file.size > 10 * 1024 * 1024) {
      alert("파일 크기는 10MB를 초과할 수 없습니다.");
      return;
    }

    setIsUploading(true);
    try {
      const processedFile = await compressImage(file);
      const fileName = `${Date.now()}_${file.name}`;
      const sRef = ref(storage, `board/${fileName}`);
      await uploadBytes(sRef, processedFile, { contentType: file.type });
      const url = await getDownloadURL(sRef);
      setFileData({ url, name: file.name, type: file.type });
    } catch (err) { alert('업로드 실패'); } finally { setIsUploading(false); }
  };

  const handleSubmit = async () => {
    if (!title.trim() && !fileData && !linkUrl.trim()) return;
    // 새 카드의 기본 order는 현재 섹션 카드들 중 가장 작은 order - 1 (가장 위로)
    const currentMinOrder = cards.length > 0 ? Math.min(...cards.map((c: any) => c.order || 0)) : 0;
    await addDoc(collection(db, 'cards'), {
      lectureId: section.lectureId, sectionId: section.id, title, content,
      linkUrl: linkUrl.trim() || null, fileUrl: fileData?.url || null,
      fileName: fileData?.name || null, fileType: fileData?.type || null,
      instructor: role === 'admin' ? '강사' : (user?.displayName || '수강생'),
      isPinned: false,
      order: currentMinOrder - 1,
      createdAt: serverTimestamp()
    });
    setTitle(''); setContent(''); setLinkUrl(''); setFileData(null); setIsAdding(false); setShowLinkInput(false);
  };

  const canAddCard = role === 'admin' || (lecture.allowStudentPosts && user);

  async function handleMoveCard(fromIndex: number, toIndex: number) {
    if (role !== 'admin') return;
    const fromCard = cards[fromIndex];
    const toCard = cards[toIndex];
    const batch = writeBatch(db);
    
    // Swap order values
    const tempOrder = fromCard.order || 0;
    batch.update(doc(db, 'cards', fromCard.id), { order: toCard.order || 0 });
    batch.update(doc(db, 'cards', toCard.id), { order: tempOrder });
    
    await batch.commit();
  }

  return (
    <div className="w-80 flex-shrink-0 flex flex-col max-h-full">
      <div className="flex justify-between items-center mb-6 px-3">
        <h3 className="text-white font-black text-xl tracking-tight text-slate-200">{section.title}</h3>
        {role === 'admin' && <button onClick={() => deleteDoc(doc(db, 'sections', section.id))} className="text-slate-600 hover:text-red-400 transition-colors"><Trash2 size={18} /></button>}
      </div>
      <div className="flex-1 overflow-y-auto space-y-5 pr-3 custom-scrollbar text-slate-900 pb-20">
        {canAddCard && !isAdding && (
          <button onClick={() => setIsAdding(true)} className="w-full py-5 border-2 border-dashed border-white/5 rounded-[2rem] flex items-center justify-center text-slate-600 hover:border-pink-500/50 hover:text-pink-500 hover:bg-pink-500/5 transition-all group">
            <Plus size={28} className="group-hover:rotate-90 transition-all duration-300" />
          </button>
        )}
        {isAdding && (
          <div className="bg-white rounded-[2rem] p-6 shadow-2xl relative animate-in zoom-in-95">
            <input placeholder="제목" value={title} onChange={e => setTitle(e.target.value)} className="w-full font-black outline-none mb-3 text-lg text-slate-900" />
            <textarea placeholder="내용을 입력하세요..." value={content} onChange={e => setContent(e.target.value)} className="w-full text-sm outline-none min-h-[100px] mb-4 resize-none font-bold text-slate-900" />
            {fileData && fileData.type.startsWith('image/') && (
              <div className="mb-4 relative rounded-xl overflow-hidden bg-slate-100">
                <img src={fileData.url} alt="Preview" className="w-full h-auto" />
                <button onClick={() => setFileData(null)} className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full"><X size={14}/></button>
              </div>
            )}
            {fileData && !fileData.type.startsWith('image/') && (
              <div className="mb-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-3 relative">
                <FileText size={24} className="text-blue-500" />
                <div className="flex-1 overflow-hidden">
                  <p className="text-xs font-black text-slate-900 truncate">{fileData.name}</p>
                </div>
                <button onClick={() => setFileData(null)} className="p-1 hover:bg-slate-200 rounded-full transition-colors"><X size={16} className="text-slate-400" /></button>
              </div>
            )}
            {showLinkInput && (
              <div className="mb-4 p-3 bg-blue-50 rounded-xl flex items-center gap-2">
                <LinkIcon size={16} className="text-blue-500" />
                <input placeholder="https://..." value={linkUrl} onChange={e => setLinkUrl(e.target.value)} className="bg-transparent text-xs w-full outline-none text-blue-600 font-bold" />
              </div>
            )}
            <div className="flex justify-between items-center pt-4 border-t">
              <div className="flex gap-1">
                <button onClick={() => fileRef.current?.click()} className="p-2 text-slate-400 hover:bg-slate-50 rounded-xl transition-colors" title="콘텐츠 첨부 (최대 10MB)"><Paperclip size={20} /></button>
                <input ref={fileRef} type="file" className="hidden" onChange={handleFileUpload} />
                <button onClick={() => setShowLinkInput(!showLinkInput)} className="p-2 text-slate-400 hover:bg-slate-50 rounded-xl transition-colors" title="링크 추가"><LinkIcon size={20} /></button>
              </div>
              <div className="flex gap-2">
                 <button onClick={() => {setIsAdding(false); setFileData(null);}} className="text-slate-300 font-bold px-2 hover:text-slate-500">취소</button>
                 <button onClick={handleSubmit} disabled={isUploading} className="bg-slate-900 text-white p-3 rounded-2xl shadow-lg active:scale-95 transition-all hover:bg-black">{isUploading ? <Loader2 className="animate-spin" size={20} /> : <ArrowRight size={20}/>}</button>
              </div>
            </div>
          </div>
        )}
        {cards.map((card: any, index: number) => (
          <Card 
            key={card.id} 
            card={card} 
            role={role} 
            onPreview={onPreview}
            onMoveUp={index > 0 ? () => handleMoveCard(index, index - 1) : null}
            onMoveDown={index < cards.length - 1 ? () => handleMoveCard(index, index + 1) : null}
          />
        ))}
      </div>
    </div>
  );
}

// --- 카드 (게시물) ---
function Card({ card, role, onPreview, onMoveUp, onMoveDown }: any) {
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(card.title || '');
  const [editedContent, setEditedContent] = useState(card.content || '');
  const { user } = useAuthStore();

  useEffect(() => {
    const q = query(collection(db, 'comments'), where('cardId', '==', card.id), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, (s) => setComments(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsub();
  }, [card.id]);

  const addComment = async (e: any) => {
    e.preventDefault(); if (!newComment.trim()) return;
    await addDoc(collection(db, 'comments'), { cardId: card.id, text: newComment, author: user?.displayName || '익명 수강생', createdAt: serverTimestamp() });
    setNewComment('');
  };

  const handleCopy = async () => {
    const textToCopy = `${card.title ? card.title + '\n' : ''}${card.content || ''}`;
    await navigator.clipboard.writeText(textToCopy);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const togglePin = async () => {
    if (role !== 'admin') return;
    await updateDoc(doc(db, 'cards', card.id), { isPinned: !card.isPinned });
  };

  const handleUpdateCard = async () => {
    if (role !== 'admin') return;
    await updateDoc(doc(db, 'cards', card.id), {
      title: editedTitle,
      content: editedContent,
      updatedAt: serverTimestamp()
    });
    setIsEditing(false);
  };

  const renderContentWithLinks = (content: string) => {
    if (!content) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return content.split(urlRegex).map((part, index) => {
      if (part.match(urlRegex)) {
        return <a key={index} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline break-all">{part}</a>;
      }
      return part;
    });
  };

  return (
    <div className={`bg-white rounded-[2rem] shadow-sm group hover:-translate-y-1.5 transition-all border p-6 text-slate-900 mb-5 w-full overflow-hidden relative ${card.isPinned ? 'border-blue-500 shadow-blue-100 ring-2 ring-blue-500/10' : 'border-slate-100'}`}>
      {card.isPinned && (
        <div className="absolute top-0 right-0 p-3">
          <Pin size={16} className="text-blue-500 fill-blue-500" />
        </div>
      )}
      
      <div className="flex justify-between items-center mb-4">
         <div className="flex items-center gap-2">
           <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{card.instructor}</span>
           {card.isPinned && <span className="text-[8px] font-black bg-blue-500 text-white px-1.5 py-0.5 rounded-full uppercase tracking-tighter">Pinned</span>}
         </div>
         <div className="flex items-center gap-1">
           {role === 'admin' && (
             <div className="flex items-center gap-1 mr-2 border-r pr-2 border-slate-100">
               <button onClick={togglePin} className={`p-1.5 rounded-lg transition-all ${card.isPinned ? 'text-blue-500 bg-blue-50' : 'text-slate-300 hover:bg-slate-50'}`} title="상단 고정">
                 <Pin size={14}/>
               </button>
               <div className="flex flex-col gap-0.5">
                 {onMoveUp && <button onClick={onMoveUp} className="text-slate-300 hover:text-blue-500 transition-colors" title="위로 이동"><ChevronUp size={14}/></button>}
                 {onMoveDown && <button onClick={onMoveDown} className="text-slate-300 hover:text-blue-500 transition-colors" title="아래로 이동"><ChevronDown size={14}/></button>}
               </div>
             </div>
           )}
           <button onClick={handleCopy} className={`p-2 rounded-xl transition-all ${isCopied ? 'text-green-500' : 'text-slate-200 hover:text-slate-400'}`} title="내용 복사">
             {isCopied ? <Check size={16}/> : <Copy size={16}/>}
           </button>
           {role === 'admin' && (
             isEditing ? (
               <div className="flex items-center gap-1">
                 <button onClick={handleUpdateCard} className="p-2 text-blue-500 hover:bg-blue-50 rounded-xl transition-colors" title="저장"><Check size={16}/></button>
                 <button onClick={() => setIsEditing(false)} className="p-2 text-slate-400 hover:bg-slate-50 rounded-xl transition-colors" title="취소"><X size={16}/></button>
               </div>
             ) : (
               <button onClick={() => setIsEditing(true)} className="p-2 text-slate-200 hover:text-blue-500 transition-all" title="편집"><Pencil size={16}/></button>
             )
           )}
           {role === 'admin' && <button onClick={() => { if(confirm('삭제하시겠습니까?')) deleteDoc(doc(db, 'cards', card.id)) }} className="text-slate-200 hover:text-red-500 transition-all"><Trash2 size={16}/></button>}
         </div>
      </div>
      {isEditing ? (
        <>
          <input value={editedTitle} onChange={e => setEditedTitle(e.target.value)} className="w-full font-black text-lg mb-2 leading-tight tracking-tight text-slate-900 break-words outline-none border-b border-slate-200 focus:border-blue-500" />
          <textarea value={editedContent} onChange={e => setEditedContent(e.target.value)} className="w-full text-[14px] text-slate-500 mb-4 whitespace-pre-wrap leading-relaxed font-bold text-slate-600 break-words outline-none min-h-[100px] border-b border-slate-200 focus:border-blue-500" />
        </>
      ) : (
        <>
          {card.title && <h4 className="font-black text-lg mb-2 leading-tight tracking-tight text-slate-900 break-words">{card.title}</h4>}
          {card.content && <p className="text-[14px] text-slate-500 mb-4 whitespace-pre-wrap leading-relaxed font-bold text-slate-600 break-words">{renderContentWithLinks(card.content)}</p>}
        </>
      )}
      
      <div className="space-y-3 mb-4">
        {/* PDF/이미지 뷰어 썸네일 */}
        {card.fileUrl && (card.fileType?.startsWith('image/') || card.fileType === 'application/pdf') && (
          <div onClick={() => onPreview({ url: card.fileUrl, type: card.fileType })} className="relative group/file cursor-pointer rounded-2xl overflow-hidden border border-slate-100 bg-slate-50/50">
            {card.fileType.startsWith('image/') ? (
              <img src={card.fileUrl} alt="첨부 이미지" className="w-full h-auto group-hover/file:opacity-90 transition-opacity" />
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-blue-500 hover:text-blue-600 transition-colors">
                <FileText size={48} className="mb-3" />
                <p className="text-xs font-black truncate max-w-full px-4 text-slate-700">{card.fileName}</p>
                <span className="mt-4 px-4 py-1.5 bg-blue-100 text-blue-700 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm">PDF 뷰어로 열기</span>
              </div>
            )}
          </div>
        )}

        {/* 일반 다운로드 파일 */}
        {card.fileUrl && !card.fileType?.startsWith('image/') && card.fileType !== 'application/pdf' && (
          <a href={card.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-slate-100 transition-all">
            <FileText size={20} className="text-slate-400" />
            <div className="flex-1 overflow-hidden"><p className="text-xs font-black text-slate-900 truncate">{card.fileName}</p></div>
            <Download size={18} className="text-slate-400" />
          </a>
        )}

        {/* 링크 썸네일 미리보기 */}
        {card.linkUrl && <LinkPreview url={card.linkUrl} />}
      </div>

      {/* 댓글 기능 */}
      <div className="pt-5 border-t border-slate-50">
        <div className="flex items-center gap-2 text-slate-300 mb-4 text-[10px] font-black uppercase tracking-widest"><MessageCircle size={16}/> {comments.length} Comments</div>
        <div className="space-y-3 mb-4 max-h-40 overflow-y-auto custom-scrollbar">
           {comments.map(c => <div key={c.id} className="text-[12px] bg-slate-50/50 p-3 rounded-2xl border border-slate-100/50 text-slate-700 font-bold"><span className="font-black text-indigo-500 mr-2">{c.author}</span>{c.text}</div>)}
        </div>
        <form onSubmit={addComment} className="relative mt-2">
           <input value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="댓글 작성..." className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-2.5 text-xs outline-none focus:border-indigo-300 focus:bg-white transition-all text-slate-900 font-bold" />
           <button type="submit" className="absolute right-3 top-2 text-indigo-500 hover:scale-110 active:scale-90 transition-all"><Send size={20}/></button>
        </form>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center bg-white"><Loader2 className="animate-spin text-blue-600 w-12 h-12" /></div>}>
      <HomeContent />
    </Suspense>
  );
}