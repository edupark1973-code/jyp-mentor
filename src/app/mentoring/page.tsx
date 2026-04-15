'use client';

import { useState, useEffect, Suspense } from 'react';
import { collection, query, where, orderBy, onSnapshot, addDoc, doc, updateDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useAuthStore } from '@/store/useAuthStore';
import { Calendar as CalendarIcon, Clock, Upload, FileText, CheckCircle, Loader2, ChevronLeft, ChevronRight, MessageSquareText, AlertCircle, MapPin, User, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Slot {
  id: string;
  date: string;
  time: string;
  isBooked: boolean;
  location?: string;
  instructorUid?: string; 
  instructorName?: string;
}

function MentoringContent() {
  const router = useRouter();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [requestText, setRequestText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [myBookings, setMyBookings] = useState<any[]>([]);
  
  const [selectedInstructorUid, setSelectedInstructorUid] = useState<string | null>(null);
  
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const { user, loading: authLoading } = useAuthStore();

  useEffect(() => {
    const q = query(collection(db, 'mentoring_slots'), where('isBooked', '==', false), orderBy('date'), orderBy('time'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSlots(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Slot[]);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'bookings'), where('menteeId', '==', user.uid), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMyBookings(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, [user]);

  const handleBooking = async () => {
    if (!user || !selectedSlot) return;
    setIsSubmitting(true);

    try {
      let fileUrl = null;
      let fileName = null;

      if (file) {
        const storageRef = ref(storage, `bookings/${user.uid}/${Date.now()}_${file.name}`);
        const uploadResult = await uploadBytes(storageRef, file);
        fileUrl = await getDownloadURL(uploadResult.ref);
        fileName = file.name;
      }

      const bookingData = {
        menteeId: user.uid,
        menteeName: user.displayName,
        menteeEmail: user.email,
        slotId: selectedSlot.id,
        date: selectedSlot.date,
        time: selectedSlot.time,
        location: selectedSlot.location || '장소 미지정',
        businessPlanUrl: fileUrl,
        businessPlanName: fileName,
        requestText: requestText.trim() || null,
        status: 'pending',
        instructorName: selectedSlot.instructorName || '강사', 
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'bookings'), bookingData);
      await updateDoc(doc(db, 'mentoring_slots', selectedSlot.id), {
        isBooked: true,
        menteeName: user.displayName,
      });

      alert('멘토링 예약이 완료되었습니다!');
      setSelectedSlot(null);
      setSelectedDate(null);
      setFile(null);
      setRequestText('');
    } catch (error) {
      console.error('Booking error:', error);
      alert('예약 처리 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelBooking = async (bookingId: string, slotId: string) => {
    if (!confirm('예약을 취소하시겠습니까?')) return;
    try {
      await deleteDoc(doc(db, 'bookings', bookingId));
      await updateDoc(doc(db, 'mentoring_slots', slotId), {
        isBooked: false,
        menteeName: null,
      });
      alert('예약이 취소되었습니다.');
    } catch (error) {
      console.error('Cancel error:', error);
      alert('취소 처리 중 오류가 발생했습니다.');
    }
  };

  const handleDismissCanceled = async (bookingId: string) => {
    try {
      await deleteDoc(doc(db, 'bookings', bookingId));
    } catch (error) {
      console.error('Dismiss error:', error);
    }
  };

  const renderTextWithLinks = (text: string) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.split(urlRegex).map((part, index) => {
      if (part.match(urlRegex)) {
        return <a key={index} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline break-all">{part}</a>;
      }
      return part;
    });
  };

  if (authLoading) return (
    <div className="h-screen flex items-center justify-center bg-white"><Loader2 className="animate-spin text-blue-600" size={40} /></div>
  );

  const uniqueInstructors = Array.from(new Set(slots.map(s => s.instructorUid))).map(uid => {
    const slot = slots.find(s => s.instructorUid === uid);
    const slotsCount = slots.filter(s => s.instructorUid === uid).length;
    return { uid, name: slot?.instructorName || '알 수 없는 강사', slotsCount };
  }).filter(inst => inst.uid);

  const instructorSlots = slots.filter(s => s.instructorUid === selectedInstructorUid);
  
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const calendarDays = [];
  for (let i = 0; i < firstDayOfMonth; i++) calendarDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`);
  }

  const availableDates = Array.from(new Set(instructorSlots.map(s => s.date)));
  const availableTimesForSelectedDate = instructorSlots.filter(s => s.date === selectedDate);

  const handlePrevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-12">
      <header className="flex items-center gap-4 mb-12 relative">
        <button 
          onClick={() => {
            if (selectedInstructorUid) {
              setSelectedInstructorUid(null);
              setSelectedSlot(null);
              setSelectedDate(null);
            } else {
              router.push('/');
            }
          }} 
          className="p-3 bg-white rounded-2xl shadow-sm hover:bg-slate-50 transition-all border border-slate-100 z-10"
        >
          <ChevronLeft size={24} className="text-slate-600" />
        </button>
        <div>
          <h1 className="text-3xl font-black text-slate-900">
            {selectedInstructorUid ? '1:1 멘토링 예약' : '멘토 선택'}
          </h1>
          <p className="text-slate-500 font-medium">
            {selectedInstructorUid ? '전문가와 함께 사업 계획을 구체화하세요.' : '상담을 원하는 강사님을 선택해 주세요.'}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-12">
          
          {!selectedInstructorUid && (
            <section className="animate-in fade-in slide-in-from-bottom-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {uniqueInstructors.map(instructor => (
                  <div 
                    key={instructor.uid} 
                    onClick={() => {
                      setSelectedInstructorUid(instructor.uid as string);
                      setSelectedDate(null);
                      setSelectedSlot(null);
                    }}
                    className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group flex items-center justify-between"
                  >
                    <div className="flex items-center gap-5">
                      <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <User size={32} />
                      </div>
                      <div>
                        <h2 className="text-2xl font-black text-slate-900 group-hover:text-blue-600 transition-colors">{instructor.name} 강사님</h2>
                        <p className="text-slate-400 font-bold text-sm mt-1">예약 가능 일정: <span className="text-blue-500">{instructor.slotsCount}</span>개</p>
                      </div>
                    </div>
                    <ArrowRight className="text-slate-300 group-hover:text-blue-600 transition-colors" />
                  </div>
                ))}
                
                {uniqueInstructors.length === 0 && (
                  <div className="col-span-full py-16 text-center text-slate-400 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200 font-bold">
                    현재 멘토링 가능한 강사님이 없습니다.
                  </div>
                )}
              </div>
            </section>
          )}

          {selectedInstructorUid && (
            <div className="space-y-12 animate-in fade-in slide-in-from-right-8">
              
              <section>
                <h2 className="text-xl font-bold mb-6 flex items-center gap-3 text-slate-900">
                  <span className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-full text-sm">1</span>
                  날짜 및 시간 선택
                </h2>
                
                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col md:flex-row">
                  
                  <div className="p-8 md:w-1/2 md:border-r border-slate-100 bg-white">
                    <div className="flex items-center justify-between mb-6">
                      <button onClick={handlePrevMonth} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><ChevronLeft size={20} className="text-slate-600"/></button>
                      <h3 className="font-black text-lg text-slate-900">{year}년 {month + 1}월</h3>
                      <button onClick={handleNextMonth} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><ChevronRight size={20} className="text-slate-600"/></button>
                    </div>
                    
                    <div className="grid grid-cols-7 gap-2 text-center text-xs font-black text-slate-400 mb-4">
                      <div>일</div><div>월</div><div>화</div><div>수</div><div>목</div><div>금</div><div>토</div>
                    </div>
                    
                    <div className="grid grid-cols-7 gap-y-2 gap-x-1">
                      {calendarDays.map((dateStr, i) => {
                        if (!dateStr) return <div key={`empty-${i}`} className="p-2"></div>;
                        
                        const isAvailable = availableDates.includes(dateStr);
                        const isSelected = selectedDate === dateStr;
                        const day = new Date(dateStr).getDate();
                        
                        return (
                          <button
                            key={dateStr}
                            disabled={!isAvailable}
                            onClick={() => { setSelectedDate(dateStr); setSelectedSlot(null); }}
                            className={`w-10 h-10 mx-auto rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                              isSelected ? 'bg-blue-600 text-white shadow-md' :
                              isAvailable ? 'bg-blue-50 text-blue-600 hover:bg-blue-100' :
                              'text-slate-300 cursor-not-allowed'
                            }`}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="p-8 md:w-1/2 bg-slate-50/50">
                    {selectedDate ? (
                      <div className="animate-in fade-in">
                        <p className="text-sm font-black text-slate-500 mb-4 flex items-center gap-2">
                          <CalendarIcon size={16} /> {selectedDate}
                        </p>
                        <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                          {availableTimesForSelectedDate.length > 0 ? (
                            availableTimesForSelectedDate.map(slot => (
                              <button
                                key={slot.id}
                                onClick={() => setSelectedSlot(slot)}
                                className={`w-full p-4 rounded-[1rem] border-2 transition-all flex items-center justify-between group ${
                                  selectedSlot?.id === slot.id ? 'border-blue-600 bg-white shadow-md ring-2 ring-blue-600/20' : 'border-slate-200 bg-white hover:border-blue-300'
                                }`}
                              >
                                <span className={`font-black text-lg ${selectedSlot?.id === slot.id ? 'text-blue-600' : 'text-slate-700'}`}>
                                  {slot.time}
                                </span>
                                <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                                  selectedSlot?.id === slot.id ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-500'
                                }`}>
                                  <MapPin size={12}/> <span className="truncate max-w-[100px]">{slot.location || '장소 미지정'}</span>
                                </div>
                              </button>
                            ))
                          ) : (
                            <p className="text-sm font-bold text-slate-400">선택한 날짜에 가능한 시간이 없습니다.</p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-slate-400">
                        <CalendarIcon size={40} className="mb-4 opacity-30 text-blue-500"/>
                        <p className="font-bold text-slate-500">달력에서 날짜를 선택해주세요</p>
                      </div>
                    )}
                  </div>

                </div>
              </section>

              <section className={!selectedSlot ? 'opacity-30 pointer-events-none transition-all duration-500' : 'transition-all duration-500'}>
                <h2 className="text-xl font-bold mb-6 flex items-center gap-3 text-slate-900">
                  <span className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-full text-sm">2</span>
                  상담 요청 사항 및 파일 업로드
                </h2>
                
                <div className="space-y-6">
                  <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                    <label className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest mb-4">
                      <MessageSquareText size={14} className="text-blue-500" /> 멘토링 시 궁금한 점 (선택)
                    </label>
                    <textarea 
                      value={requestText}
                      onChange={e => setRequestText(e.target.value)}
                      placeholder="예: 사업 아이템의 시장성에 대해 피드백 받고 싶습니다."
                      className="w-full p-6 bg-slate-50 border border-slate-100 rounded-[1.5rem] outline-none focus:border-blue-500 resize-none h-32 text-sm font-bold text-slate-700 transition-all"
                    />
                  </div>

                  <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                    <label className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest mb-4">
                      <FileText size={14} className="text-blue-500" /> 사업계획서 또는 참고자료 (선택)
                    </label>
                    <label className="flex flex-col items-center justify-center w-full h-44 border-2 border-dashed border-slate-200 rounded-[1.5rem] cursor-pointer hover:bg-slate-50 transition-colors">
                      {file ? (
                        <div className="flex flex-col items-center gap-2">
                          <FileText className="text-blue-600" size={40} />
                          <span className="text-sm font-bold text-slate-700">{file.name}</span>
                          <span className="text-xs text-slate-400">클릭하여 파일 변경</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <Upload className="text-slate-300" size={40} />
                          <span className="text-sm font-bold text-slate-500">파일 선택 또는 드래그</span>
                          <span className="text-xs text-slate-400 font-medium">PDF, DOCX (최대 10MB)</span>
                        </div>
                      )}
                      <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                    </label>
                  </div>
                </div>
              </section>

              <section className={!selectedSlot ? 'opacity-30 pointer-events-none' : ''}>
                <button
                  onClick={handleBooking}
                  disabled={isSubmitting || !user || !selectedSlot}
                  className="w-full py-5 bg-slate-900 text-white font-black rounded-[1.5rem] hover:bg-blue-600 disabled:opacity-50 transition-all shadow-xl shadow-slate-200 flex justify-center items-center gap-3 text-lg active:scale-[0.98]"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={24} /> : <CheckCircle size={24} />}
                  예약 신청 완료하기
                </button>
                {!user && <p className="text-center mt-4 text-red-500 text-sm font-bold">로그인이 필요한 서비스입니다.</p>}
              </section>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl sticky top-8">
            <h3 className="text-lg font-black mb-8 flex items-center gap-2">
              <div className="w-1.5 h-5 bg-blue-500 rounded-full"></div>
              나의 예약 현황
            </h3>
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {myBookings.length > 0 ? (
                myBookings.map((b) => (
                  <div key={b.id} className={`p-5 rounded-2xl border transition-all ${
                    b.status === 'canceled' ? 'bg-red-500/10 border-red-500/20' : 'bg-white/5 border-white/10'
                  } group`}>
                    <div className="flex justify-between items-start mb-3">
                      <span className={`text-sm font-black ${b.status === 'canceled' ? 'text-red-400' : 'text-white'}`}>{b.date}</span>
                      <span className={`text-[10px] px-2.5 py-1 rounded-full font-black uppercase ${
                        b.status === 'accepted' ? 'bg-green-500/20 text-green-400' : 
                        b.status === 'completed' ? 'bg-purple-500/20 text-purple-400' : 
                        b.status === 'canceled' ? 'bg-red-500/20 text-red-400' : 
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                        {b.status === 'accepted' ? '승인됨' : 
                         b.status === 'completed' ? '완료' : 
                         b.status === 'canceled' ? '거절됨' : '대기'}
                      </span>
                    </div>
                    
                    <div className="text-xs text-slate-400 flex items-center justify-between mb-3">
                      <div className="flex flex-col gap-1.5 font-bold">
                        <div className="flex items-center gap-1"><Clock size={12} /> {b.time}</div>
                        {b.instructorName && (
                          <div className="flex items-center gap-1 text-slate-300"><User size={12} /> {b.instructorName} 강사님</div>
                        )}
                      </div>
                      {b.status === 'pending' && (
                        <button
                          onClick={() => handleCancelBooking(b.id, b.slotId)}
                          className="text-red-400 hover:text-red-300 font-black text-[10px] underline decoration-red-400/30 underline-offset-4 self-start"
                        >
                          예약취소
                        </button>
                      )}
                    </div>

                    <div className="p-2.5 bg-white/5 rounded-xl border border-white/5 flex items-center gap-2 mb-2">
                      <MapPin size={12} className="text-blue-400 shrink-0" />
                      <span className="text-[11px] font-bold text-slate-300 truncate">
                        {renderTextWithLinks(b.location || '장소 미지정')}
                      </span>
                    </div>

                    {b.status === 'canceled' && (
                      <div className="mt-3 p-3 bg-red-500/10 rounded-xl border border-red-500/20 space-y-2">
                        <div className="flex items-center gap-1.5 text-[10px] font-black text-red-400 uppercase tracking-tight">
                          <AlertCircle size={12} /> 거절 사유
                        </div>
                        <p className="text-[11px] text-red-200/80 font-bold leading-relaxed">{b.cancelReason}</p>
                        <button 
                          onClick={() => handleDismissCanceled(b.id)}
                          className="w-full py-1.5 mt-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-[10px] font-black rounded-lg transition-all"
                        >
                          확인 및 삭제
                        </button>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-slate-500">
                  <p className="text-sm font-bold">예약 내역이 없습니다.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MentoringPage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center bg-white"><Loader2 className="animate-spin text-blue-600" /></div>}>
      <MentoringContent />
    </Suspense>
  );
}