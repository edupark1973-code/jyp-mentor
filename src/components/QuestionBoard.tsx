'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/useAuthStore';
import { MessageSquare, Send, Pin, Trash2, User, Clock, ChevronUp, ChevronDown } from 'lucide-react';

interface Question {
  id: string;
  lectureId: string;
  authorId: string;
  authorName: string;
  content: string;
  isPinned: boolean;
  order: number;
  createdAt: any;
}

export default function QuestionBoard({ lectureId, isLiveMode = false }: { lectureId: string; isLiveMode?: boolean }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [newQuestion, setNewQuestion] = useState('');
  const { user, role } = useAuthStore();

  useEffect(() => {
    if (!lectureId) return;

    // Pin된 질문 우선, 그 다음 order(작은 순서) 우선, 그 다음 최신순
    const q = query(
      collection(db, 'questions'),
      where('lectureId', '==', lectureId),
      orderBy('isPinned', 'desc'),
      orderBy('order', 'asc'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setQuestions(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Question[]);
    });

    return () => unsubscribe();
  }, [lectureId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.trim() || !user) return;

    try {
      // 새 질문은 현재 가장 작은 order보다 더 작은 값을 갖거나 0부터 시작
      const minOrder = questions.length > 0 ? Math.min(...questions.map(q => q.order || 0)) : 0;
      
      await addDoc(collection(db, 'questions'), {
        lectureId,
        authorId: user.uid,
        authorName: user.displayName || '익명 사용자',
        content: newQuestion,
        isPinned: false,
        order: minOrder - 1, // 위로 쌓이게 하려면 마이너스, 아래로 쌓이게 하려면 플러스 (여기서는 위로 쌓이게 함)
        createdAt: serverTimestamp(),
      });
      setNewQuestion('');
    } catch (error) {
      console.error('Error adding question:', error);
      alert('질문 등록 중 오류가 발생했습니다.');
    }
  };

  const moveOrder = async (index: number, direction: 'up' | 'down') => {
    if (role !== 'admin') return;
    
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= questions.length) return;

    const currentQ = questions[index];
    const targetQ = questions[targetIndex];

    // 같은 Pin 상태일 때만 이동 가능하게 하거나, 전체 순서를 바꿀 수 있음
    // 여기서는 화면에 보이는 순서 그대로 교체
    try {
      const currentOrder = currentQ.order || 0;
      const targetOrder = targetQ.order || 0;

      await updateDoc(doc(db, 'questions', currentQ.id), { order: targetOrder });
      await updateDoc(doc(db, 'questions', targetQ.id), { order: currentOrder });
    } catch (error) {
      console.error('Order update error:', error);
    }
  };

  const togglePin = async (id: string, currentPin: boolean) => {
    if (role !== 'admin') return;
    await updateDoc(doc(db, 'questions', id), { isPinned: !currentPin });
  };

  const deleteQuestion = async (id: string) => {
    if (!confirm('질문을 삭제하시겠습니까?')) return;
    await deleteDoc(doc(db, 'questions', id));
  };

  return (
    <div className={`flex flex-col ${isLiveMode ? 'h-[80vh]' : 'space-y-6'}`}>
      {!isLiveMode && (
        <form onSubmit={handleSubmit} className="relative">
          <textarea
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            placeholder={user ? "강의에 대해 궁금한 점을 남겨주세요." : "로그인 후 질문을 남길 수 있습니다."}
            disabled={!user}
            className="w-full p-4 pr-16 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px] resize-none shadow-sm transition-all"
          />
          <button
            type="submit"
            disabled={!user || !newQuestion.trim()}
            className="absolute bottom-4 right-4 p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Send size={20} />
          </button>
        </form>
      )}

      <div className={`space-y-4 overflow-y-auto pr-2 custom-scrollbar ${isLiveMode ? 'flex-1' : ''}`}>
        {questions.length > 0 ? (
          questions.map((q) => (
            <div 
              key={q.id} 
              className={`p-5 rounded-2xl border transition-all ${
                q.isPinned 
                  ? 'bg-blue-50 border-blue-200 shadow-md ring-1 ring-blue-200' 
                  : 'bg-white border-slate-100 shadow-sm'
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-slate-100 rounded-full text-slate-500">
                    <User size={14} />
                  </div>
                  <span className="text-sm font-bold text-slate-700">{q.authorName}</span>
                  {q.isPinned && (
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-600 text-white text-[10px] font-bold rounded-full">
                      <Pin size={10} /> PINNED
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-slate-400">
                  <Clock size={12} />
                  <span className="text-[11px]">
                    {q.createdAt?.toDate ? q.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '방금 전'}
                  </span>
                </div>
              </div>
              
              <p className={`text-slate-800 whitespace-pre-wrap leading-relaxed ${isLiveMode ? 'text-xl font-medium' : 'text-sm'}`}>
                {q.content}
              </p>

              {(role === 'admin') && (
                <div className="flex justify-end items-center gap-2 mt-4 pt-3 border-t border-slate-100/50">
                  <div className="flex gap-1 mr-auto">
                    <button 
                      onClick={() => moveOrder(questions.indexOf(q), 'up')}
                      disabled={questions.indexOf(q) === 0}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-20 transition-all"
                      title="위로 이동"
                    >
                      <ChevronUp size={18} />
                    </button>
                    <button 
                      onClick={() => moveOrder(questions.indexOf(q), 'down')}
                      disabled={questions.indexOf(q) === questions.length - 1}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-20 transition-all"
                      title="아래로 이동"
                    >
                      <ChevronDown size={18} />
                    </button>
                  </div>
                  <button 
                    onClick={() => togglePin(q.id, q.isPinned)}
                    className={`p-1.5 rounded-lg transition-colors ${q.isPinned ? 'text-blue-600 bg-blue-100' : 'text-slate-400 hover:bg-slate-100'}`}
                    title="고정하기"
                  >
                    <Pin size={16} />
                  </button>
                  <button 
                    onClick={() => deleteQuestion(q.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="삭제하기"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="text-center py-20 text-slate-400 border-2 border-dashed border-slate-100 rounded-2xl">
            <MessageSquare size={40} className="mx-auto mb-3 opacity-20" />
            <p>아직 질문이 없습니다. 첫 질문을 남겨보세요!</p>
          </div>
        )}
      </div>
    </div>
  );
}
