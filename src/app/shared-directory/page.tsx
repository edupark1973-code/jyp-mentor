'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

type SharedData = { title: string; records: { fields: { label: string; value: string }[] }[] };

export default function SharedDirectoryPage() {
  const [data, setData] = useState<SharedData | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id');
    if (!id || !/^[0-9a-f-]{68}$/.test(id)) { setLoading(false); return; }
    void getDoc(doc(db, 'directory_shares', id)).then((snapshot) => {
      if (snapshot.exists()) setData(snapshot.data() as SharedData);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);
  if (loading) return <p className="p-8">자료를 불러오는 중입니다.</p>;
  if (!data) return <p className="p-8">공유가 종료되었거나 자료를 찾을 수 없습니다.</p>;
  return <main className="mx-auto max-w-5xl p-6"><h1 className="mb-6 text-3xl font-black">{data.title}</h1><div className="grid gap-4">{data.records.map((record, index) => <article key={index} className="rounded-2xl border bg-white p-5"><dl className="grid gap-3 sm:grid-cols-2">{record.fields.map((field, i) => <div key={i}><dt className="text-xs font-bold text-slate-500">{field.label}</dt><dd className="whitespace-pre-wrap break-words">{field.value}</dd></div>)}</dl></article>)}</div></main>;
}
