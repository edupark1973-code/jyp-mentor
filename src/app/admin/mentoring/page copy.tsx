'use client';

import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, updateDoc, writeBatch, serverTimestamp, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/useAuthStore';
import { Plus, Trash2, Calendar, Clock, Loader2, CheckCircle, XCircle, Layers, FileText, ExternalLink, User, Mail, Ban, CheckCircle2, MessageSquareText, X, MapPin } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Slot {
  id: string;
  date: string;
  time: string;
  isBooked: boolean;
  menteeName?: string;
  location?: string;
  duration?: number;
}

interface Booking {
  id: string;
  slotId: string;
  menteeName: string;
  menteeEmail: string;
  businessPlanUrl?: string;
  businessPlanName?: string;
  requestText?: string;
  status: string;
  cancelReason?: string;
}

export default function AdminMentoringPage() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [newDate, setNewDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [interval, setInterval] = useState(60); 
  const [location, setLocation] = useState('온라인 (Zoom)'); 
  const router = useRouter(); 
  
  const { role, user, loading: authLoading } = useAuthStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelingSlotId, setCancelingSlotId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const timeOptions: string[] = [];
  for (let i = 0; i < 24; i++) {
    const hour = i.toString().padStart(2, '0');
    timeOptions.push(`${hour}:00`);
    timeOptions.push(`${hour}:30`);
  }

  useEffect(() => {
    if (role !== 'admin' || !user) return;

    const qSlots = query(
      collection(db, 'mentoring_slots'), 
      where('instructorUid', '==', user.uid),
      orderBy('date'), 
      orderBy('time')
    );
    const unsubSlots = onSnapshot(qSlots, (snapshot) => {
      setSlots(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Slot[]);
    });

    const qBookings = query(collection(db, 'bookings'));
    const unsubBookings = onSnapshot(qBookings, (snapshot) => {
      setBookings(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Booking[]);
    });

    return () => {
      unsubSlots();
      unsubBookings();
    };
  }, [role, user]);

  const handleBulkAddSlots = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDate || !startTime || !endTime || !location.trim()) {
      alert('모든 정보를 입력해주세요.');
      return;
    }
    
    const start = parseInt(startTime.split(':')[0]) * 60 + parseInt(startTime.split(':')[1]);
    const end = parseInt(endTime.split(':')[0]) * 60 + parseInt(endTime.split(':')[1]);

    if (start >= end) {
      alert('종료 시간은 시작 시간보다 늦어야 합니다.');
      return;
    }

    setIsSubmitting(true);
    try {
      let current = start;
      const promises = [];

      while (current + interval <= end) {
        const h = Math.floor(current / 60).toString().padStart(2, '0');
        const m = (current % 60).toString().padStart(2, '0');
        const timeString = `${h}:${m}`;

        promises.push(addDoc(collection(db, 'mentoring_slots'), {
          date: newDate,
          time: timeString,
          location: location.trim(),
          duration: interval,
          isBooked: false,
          instructorUid: user?.uid,
          instructorName: user?.displayName || '공용 강사',
          createdAt: new Date().toISOString()
        }));

        current += interval;
      }

      await Promise.all(promises);
      alert(`${promises.length}개의 슬롯이 생성되었습니다.`);
    } catch (error) {
      console.error('Error adding slots:', error);
      alert('슬롯 생성 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSlot = async (id: string) => {
    if (!confirm('이 슬롯을 삭제하시겠습니까?')) return;
    await deleteDoc(doc(db, 'mentoring_slots', id));
  };

  // 👉 [수정됨] 수락 시 구글 캘린더 연동 + 에러 탐지 강화
  const handleAcceptBooking = async (bookingId: string) => {
    if (!confirm('해당 예약을 수락하시겠습니까? (수락 시 구글 캘린더에 자동 등록됩니다)')) return;

    try {
      await updateDoc(doc(db, 'bookings', bookingId), {
        status: 'accepted'
      });

      const booking = bookings.find(b => b.id === bookingId);
      const slot = slots.find(s => s.id === booking?.slotId);

      if (booking && slot) {
        const response = await fetch('/api/calendar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: slot.date,
            time: slot.time,
            duration: slot.duration || 60,
            menteeName: booking.menteeName,
            location: slot.location,
            requestText: booking.requestText,
            calendarId: 'fd8dba786b6aeebdabda4191e5591b1580a66f5a1dcad94e288a7ca68ece2df2@group.calendar.google.com' 
          }),
        });

        // 🚨 API 호출 실패 시 에러를 억지로 통과시키지 않고 에러를 발생시킵니다.
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || '구글 캘린더 API 연동에 실패했습니다.');
        }
      }

      alert('예약이 수락되었으며, 구글 캘린더에 정상적으로 등록되었습니다! 🎉');
    } catch (error: any) {
      console.error('Accept booking error:', error);
      // 구글 API가 거절한 진짜 이유를 팝업으로 띄워줍니다.
      alert(`[캘린더 연동 실패] ${error.message}\nVS Code 터미널 창의 에러 로그를 확인해주세요!`);
    }
  };

  const confirmCancelBooking = async () => {
    if (!cancelingSlotId || !cancelReason.trim()) {
      alert('취소 사유를 입력해주세요.');
      return;
    }

    try {
      const q = query(collection(db, 'bookings'), where('slotId', '==', cancelingSlotId));
      const snapshot = await getDocs(q);
      
      const batch = writeBatch(db);
      
      snapshot.forEach((d) => {
        batch.update(doc(db, 'bookings', d.id), {
          status: 'canceled',
          cancelReason: cancelReason.trim(),
          canceledAt: serverTimestamp()
        });
      });

      batch.update(doc(db, 'mentoring_slots', cancelingSlotId), {
        isBooked: false,
        menteeName: null
      });

      await batch.commit();
      alert('예약이 성공적으로 거절/취소되었습니다.');
      setShowCancelModal(false);
      setCancelingSlotId(null);
      setCancelReason('');
    } catch (error) {
      console.error('Cancel booking error:', error);
      alert('예약 취소 중 오류가 발생했습니다.');
    }
  };

  const renderTextWithLinks = (text: string) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.split(urlRegex).map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a key={index} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline break-all">
            {part}
          </a>
        );
      }
      return part;
    });
  };

  if (authLoading) return null;
  if (role !== 'admin') {
    setTimeout(() => router.push('/'), 1000);
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <p className="text-lg font-bold text-slate-500">권한이 없습니다. 메인 화면으로 이동합니다...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 text-slate-900">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold">멘토링 가용 시간 관리</h1>
          <p className="text-slate-500 text-sm">일괄 생성을 통해 여러 슬롯을 한 번에 등록하세요.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Bulk Slot Creation Form */}
        <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xl h-fit lg:sticky lg:top-24">
          <h2 className="font-bold mb-6 flex items-center gap-2 text-blue-600">
            <Layers size={20} />
            슬롯 일괄 생성
          </h2>
          <form onSubmit={handleBulkAddSlots} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">상담 날짜</label>
              <input 
                type="date" 
                required
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all outline-none"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">시작 시간</label>
                <select 
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium cursor-pointer"
                >
                  {timeOptions.map(time => (
                    <option key={`start-${time}`} value={time}>{time}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">종료 시간</label>
                <select 
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium cursor-pointer"
                >
                  {timeOptions.map(time => (
                    <option key={`end-${time}`} value={time}>{time}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">상담 장소 (링크 포함 가능)</label>
              <input 
                type="text" 
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="예: 온라인(Zoom), 스타트업 카페 2층"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all outline-none font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">상담 단위 (간격)</label>
              <select 
                value={interval}
                onChange={(e) => setInterval(Number(e.target.value))}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium cursor-pointer"
              >
                <option value={30}>30분 단위</option>
                <option value={60}>1시간 단위</option>
                <option value={90}>1시간 30분 단위</option>
                <option value={120}>2시간 단위</option>
              </select>
            </div>

            <button 
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 disabled:opacity-50 transition-all shadow-lg flex justify-center items-center gap-2 mt-4"
            >
              {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
              슬롯 일괄 생성하기
            </button>
          </form>
        </section>

        {/* Slot List */}
        <section className="lg:col-span-2">
          <h2 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Calendar size={20} className="text-slate-400" />
            현재 등록된 슬롯 목록 ({slots.length})
          </h2>
          <div className="space-y-4">
            {slots.length > 0 ? (
              slots.map((slot) => {
                const booking = bookings.find(b => b.slotId === slot.id && b.status !== 'canceled');
                return (
                  <div key={slot.id} className={`p-6 rounded-[2rem] border transition-all ${slot.isBooked ? 'bg-blue-50 border-blue-100' : 'bg-white border-slate-100 hover:border-blue-200 shadow-sm'}`}>
                    <div className="flex flex-col md:flex-row justify-between md:items-center gap-6">
                      <div className="flex items-center gap-4">
                        <div className={`p-4 rounded-2xl ${slot.isBooked ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400'}`}>
                          <Clock size={24} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{slot.date}</p>
                          <p className="text-blue-600 font-black text-2xl">{slot.time}</p>
                          <p className="text-[11px] text-slate-400 font-bold flex items-center gap-1 mt-1 uppercase tracking-tighter">
                            <MapPin size={10} /> {renderTextWithLinks(slot.location || '장소 미지정')}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex-1 max-w-md">
                        {slot.isBooked && booking ? (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              {booking.status === 'accepted' ? (
                                <span className="text-[10px] font-black px-2 py-1 bg-green-600 text-white rounded-md uppercase tracking-wider flex items-center gap-1">
                                  <CheckCircle size={10} /> Accepted
                                </span>
                              ) : (
                                <span className="text-[10px] font-black px-2 py-1 bg-blue-600 text-white rounded-md uppercase tracking-wider">Reserved</span>
                              )}
                              <div className="flex items-center gap-1.5 text-slate-600 font-bold text-sm">
                                <User size={14} className="text-blue-400" /> {booking.menteeName}
                                <Mail size={14} className="text-slate-400 ml-1" /> <span className="text-xs font-medium text-slate-400">{booking.menteeEmail}</span>
                              </div>
                            </div>

                            {booking.requestText && (
                              <div className="bg-white/80 p-3 rounded-xl border border-blue-100/50">
                                <div className="flex items-center gap-1.5 text-[10px] font-black text-blue-400 uppercase tracking-tight mb-1">
                                  <MessageSquareText size={12} /> 상담 요청 내용
                                </div>
                                <p className="text-xs text-slate-600 font-bold whitespace-pre-wrap leading-relaxed">{booking.requestText}</p>
                              </div>
                            )}
                            
                            {booking.businessPlanUrl && (
                              <div className="flex items-center gap-2 bg-white/60 p-2 rounded-xl border border-blue-100">
                                <FileText size={16} className="text-blue-500" />
                                <span className="text-xs font-bold text-slate-600 truncate flex-1">{booking.businessPlanName || '사업계획서'}</span>
                                <button 
                                  onClick={() => window.open(booking.businessPlanUrl, '_blank')}
                                  className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-sm"
                                  title="파일 보기"
                                >
                                  <ExternalLink size={14} />
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-slate-400 font-medium text-sm italic">예약 대기 중</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 justify-end">
                        {slot.isBooked ? (
                          <>
                            {booking && booking.status !== 'accepted' && (
                              <button 
                                onClick={() => handleAcceptBooking(booking.id)}
                                className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-600 rounded-xl font-bold text-xs hover:bg-green-600 hover:text-white transition-all border border-green-100"
                                title="예약 수락"
                              >
                                <CheckCircle2 size={16} /> 수락
                              </button>
                            )}
                            <button 
                              onClick={() => {
                                setCancelingSlotId(slot.id);
                                setShowCancelModal(true);
                              }}
                              className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-500 rounded-xl font-bold text-xs hover:bg-red-500 hover:text-white transition-all border border-red-100"
                              title="예약 거절/취소"
                            >
                              <Ban size={16} /> 거절
                            </button>
                          </>
                        ) : (
                          <button 
                            onClick={() => handleDeleteSlot(slot.id)}
                            className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all border border-transparent hover:border-red-100"
                            title="슬롯 삭제"
                          >
                            <Trash2 size={20} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-24 text-center text-slate-400 bg-white rounded-3xl border-2 border-dashed border-slate-100">
                등록된 슬롯이 없습니다. 왼쪽 양식을 통해 슬롯을 생성하세요.
              </div>
            )}
          </div>
        </section>
      </div>

      {/* 취소 사유 입력 모달 */}
      {showCancelModal && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-6" onClick={() => setShowCancelModal(false)}>
          <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-lg shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black text-slate-900">예약 거절 및 취소</h2>
              <button onClick={() => setShowCancelModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X/></button>
            </div>
            
            <p className="text-slate-500 font-medium mb-6 leading-relaxed">
              신청자에게 전달할 거절 사유를 입력해주세요. <br/>
              사유를 입력하면 슬롯은 다시 예약 가능 상태로 변경됩니다.
            </p>

            <textarea 
              autoFocus
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              placeholder="예: 해당 시간에는 다른 일정이 있어 멘토링이 어렵습니다. 다른 시간을 선택해주세요."
              className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-red-500 resize-none h-32 text-sm font-bold text-slate-700 transition-all mb-8"
            />

            <div className="flex gap-4">
              <button 
                onClick={confirmCancelBooking}
                className="flex-1 bg-red-500 text-white py-4 rounded-2xl font-black shadow-lg shadow-red-100 hover:bg-red-600 transition-all active:scale-95"
              >
                거절 및 취소 완료
              </button>
              <button 
                onClick={() => setShowCancelModal(false)}
                className="px-8 bg-slate-100 text-slate-500 py-4 rounded-2xl font-black hover:bg-slate-200 transition-all"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}