"use client";

import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

function QnaContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !id || loading) return;

    setLoading(true);
    try {
      await addDoc(collection(db, 'questions'), {
        lectureId: id,
        text: question,
        createdAt: serverTimestamp(),
      });
      setDone(true);
      setQuestion('');
    } catch (e) {
      alert("전송 실패!");
    } finally {
      setLoading(false);
    }
  };

  if (done) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <h2 className="text-2xl font-bold text-blue-600 mb-2">포스트 전송 완료!</h2>
      <p className="text-gray-500 mb-6">강사님 화면을 확인해 보세요.</p>
      <button onClick={() => setDone(false)} className="bg-gray-100 px-6 py-3 rounded-xl font-bold">추가 포스트 하기</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-black mb-6">포스트 하기</h1>
        <form onSubmit={send} className="space-y-4">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="내용을 입력하세요"
            className="w-full h-40 p-4 rounded-2xl border-none shadow-inner focus:ring-2 focus:ring-blue-500"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold text-lg disabled:bg-gray-400"
          >
            {loading ? "보내는 중..." : " 보내기"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function QnaPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center">로딩 중...</div>}>
      <QnaContent />
    </Suspense>
  );
}