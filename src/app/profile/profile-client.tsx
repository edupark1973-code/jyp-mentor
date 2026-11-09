'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { ArrowDown, ArrowRight, ArrowUp, Check, Copy, ExternalLink, Plus, Settings, Trash2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { isSafeExternalUrl } from '@/lib/startupLinks';
import { useAuthStore } from '@/store/useAuthStore';

type ProfileLink = { title: string; description: string; url: string };
type Profile = { name: string; subtitle: string; introduction: string; imageUrl: string; links: ProfileLink[] };
const initialProfile: Profile = {
  name: '박정용 교수', subtitle: '한남대 인문사회융합인재양성사업단',
  introduction: '창업가의 아이디어와 성장을 함께 고민합니다.', imageUrl: '/mentor-profile.jpg',
  links: [
    { title: '박정용 멘토 소개', description: '네이버 인물검색', url: 'https://search.naver.com/search.naver?where=nexearch&sm=tab_etc&mra=bjky&pkid=1&os=483549&qvt=0&query=%EB%B0%95%EC%A0%95%EC%9A%A9' },
    { title: '창업멘토링 카카오톡 채널', description: '멘토링 일정과 창업정보 구독', url: 'http://pf.kakao.com/_zHzgn' },
    { title: '멘토링 장소 안내', description: '한남대학교 문과대학 약도', url: '/mentoring-place' },
    { title: '창업가를 위한 추천 링크 모음', description: '지역별 창업가 단톡과 창업교육·정보', url: '/startup-links' },
  ],
};
const validUrl = (url: string) => (url.startsWith('/') && !url.startsWith('//')) || isSafeExternalUrl(url);

export default function ProfileClient() {
  const { user, role } = useAuthStore();
  const canEdit = !!user && role === 'mentor';
  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [draft, setDraft] = useState<Profile>(initialProfile);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => onSnapshot(doc(db, 'public_profiles', 'mentor'), snap => {
    if (snap.exists()) {
      const data = snap.data();
      setProfile({ ...initialProfile, ...data, links: Array.isArray(data.links) ? data.links.map((link: ProfileLink) => ({ ...link, url: link.url?.replace(/^https?:\/\/sites\.google\.com\/view\/huss-meet\/?(?:[?#].*)?$/, '/mentoring-place') })) : initialProfile.links });
    } else setProfile(initialProfile);
    setError('');
  }, () => setError('저장된 프로필을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')), []);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canEdit || saving) return;
    const next = { ...draft, name: draft.name.trim(), subtitle: draft.subtitle.trim(), introduction: draft.introduction.trim(), imageUrl: draft.imageUrl.trim(), links: draft.links.map(link => ({ title: link.title.trim(), description: link.description.trim(), url: link.url.trim() })) };
    if (!next.name || (next.imageUrl && !validUrl(next.imageUrl)) || next.links.some(link => !link.title || !validUrl(link.url))) {
      setError('이름과 링크 제목을 입력하고, 주소가 올바른지 확인해 주세요.'); return;
    }
    setSaving(true); setError('');
    try { await setDoc(doc(db, 'public_profiles', 'mentor'), next); setEditing(false); }
    catch { setError('저장하지 못했습니다. 로그인 상태와 연결을 확인해 주세요.'); }
    finally { setSaving(false); }
  };
  const changeLink = (index: number, patch: Partial<ProfileLink>) => setDraft(current => ({ ...current, links: current.links.map((link, i) => i === index ? { ...link, ...patch } : link) }));
  const moveLink = (index: number, offset: number) => setDraft(current => {
    const links = [...current.links]; const target = index + offset;
    if (target < 0 || target >= links.length) return current;
    [links[index], links[target]] = [links[target], links[index]]; return { ...current, links };
  });
  const copy = async () => {
    try { await navigator.clipboard.writeText(`${window.location.origin}/profile`); setCopied(true); window.setTimeout(() => setCopied(false), 2000); }
    catch { window.alert('브라우저 주소창에서 주소를 복사해 주세요.'); }
  };

  return <div className="min-h-screen bg-[#f3f6fb] px-4 pb-20 text-slate-900">
    <div className="mx-auto max-w-2xl pt-10 sm:pt-16">
      <div className="overflow-hidden rounded-[2rem] bg-white shadow-xl shadow-slate-200/70">
        <div className="h-36 bg-gradient-to-br from-blue-700 via-indigo-700 to-slate-900 sm:h-44" />
        <div className="px-6 pb-8 sm:px-10">
          <div className="-mt-16 flex items-end justify-between gap-4">
            {profile.imageUrl && validUrl(profile.imageUrl) ? <img src={profile.imageUrl} alt={`${profile.name} 프로필 사진`} className="h-32 w-32 rounded-3xl border-[6px] border-white bg-slate-100 object-cover shadow-lg" /> : <div className="flex h-32 w-32 items-center justify-center rounded-3xl border-[6px] border-white bg-blue-100 text-4xl font-black text-blue-700">{profile.name.slice(0, 1)}</div>}
            {canEdit && <button type="button" onClick={() => { setDraft({ ...profile, links: profile.links.map(link => ({ ...link })) }); setEditing(true); setError(''); }} className="mb-1 flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-200"><Settings size={16} /> 프로필 편집</button>}
          </div>
          <p className="mt-7 text-xs font-black tracking-[0.2em] text-blue-600">STARTUP MENTOR</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{profile.name}</h1>
          <p className="mt-2 font-bold text-slate-600">{profile.subtitle}</p>
          {profile.introduction && <p className="mt-5 whitespace-pre-line leading-7 text-slate-500">{profile.introduction}</p>}
          <button type="button" onClick={() => void copy()} className="mt-6 inline-flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-700 hover:bg-blue-100">{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? '주소 복사 완료' : '프로필 주소 복사'}</button>
        </div>
      </div>
      {error && !editing && <p role="alert" className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">{error}</p>}
      <div className="mb-4 mt-10 flex items-end justify-between"><div><p className="text-xs font-black tracking-[0.2em] text-blue-600">CONNECT WITH ME</p><h2 className="mt-2 text-2xl font-black">함께 살펴볼 링크</h2></div><span className="text-sm text-slate-400">{profile.links.length} links</span></div>
      <div className="space-y-3">{profile.links.filter(link => validUrl(link.url)).map((link, index) => <a key={`${link.url}-${index}`} href={link.url} target={link.url.startsWith('/') ? undefined : '_blank'} rel="noopener noreferrer" className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 font-black text-blue-600">{String(index + 1).padStart(2, '0')}</span><span className="min-w-0 flex-1"><span className="block font-black text-slate-900">{link.title}</span>{link.description && <span className="mt-1 block text-sm leading-5 text-slate-500">{link.description}</span>}</span><ArrowRight size={20} className="shrink-0 text-blue-500 transition group-hover:translate-x-1" /></a>)}</div>
      <p className="mt-12 text-center text-xs font-bold tracking-widest text-slate-400">POWERED BY EDUREPORT</p>
    </div>
    {editing && canEdit && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4"><div role="dialog" aria-modal="true" aria-labelledby="profile-edit-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 sm:p-8"><h2 id="profile-edit-title" className="text-2xl font-black">프로필 편집</h2><form onSubmit={save} className="mt-6 space-y-4">
      <label className="block text-sm font-bold">이름<input required maxLength={80} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 p-3 font-medium" /></label>
      <label className="block text-sm font-bold">소속·직함<input maxLength={150} value={draft.subtitle} onChange={e => setDraft({ ...draft, subtitle: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 p-3 font-medium" /></label>
      <label className="block text-sm font-bold">인사말<textarea maxLength={500} rows={3} value={draft.introduction} onChange={e => setDraft({ ...draft, introduction: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 p-3 font-medium" /></label>
      <label className="block text-sm font-bold">프로필 사진 주소<input value={draft.imageUrl} onChange={e => setDraft({ ...draft, imageUrl: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 p-3 font-medium" /><span className="mt-1 block text-xs font-normal text-slate-500">인터넷 이미지 주소를 입력하거나 비워둘 수 있습니다.</span></label>
      <div className="flex items-center justify-between pt-3"><h3 className="text-lg font-black">링크 목록</h3><button type="button" onClick={() => setDraft({ ...draft, links: [...draft.links, { title: '', description: '', url: '' }] })} className="flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700"><Plus size={16} /> 추가</button></div>
      {draft.links.map((link, index) => <div key={index} className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center justify-between"><span className="font-bold">링크 {index + 1}</span><div className="flex gap-1"><button type="button" disabled={index === 0} onClick={() => moveLink(index, -1)} aria-label="위로 이동" className="rounded-lg p-2 disabled:opacity-30"><ArrowUp size={16} /></button><button type="button" disabled={index === draft.links.length - 1} onClick={() => moveLink(index, 1)} aria-label="아래로 이동" className="rounded-lg p-2 disabled:opacity-30"><ArrowDown size={16} /></button><button type="button" onClick={() => setDraft({ ...draft, links: draft.links.filter((_, i) => i !== index) })} aria-label="링크 삭제" className="rounded-lg p-2 text-red-500"><Trash2 size={16} /></button></div></div><input required placeholder="링크 제목" aria-label="링크 제목" value={link.title} onChange={e => changeLink(index, { title: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-white p-3" /><input placeholder="설명" aria-label="링크 설명" value={link.description} onChange={e => changeLink(index, { description: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-white p-3" /><input required placeholder="https:// 또는 /로 시작하는 주소" aria-label="링크 주소" value={link.url} onChange={e => changeLink(index, { url: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-white p-3" /></div>)}
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}<div className="flex gap-3"><button type="button" onClick={() => setEditing(false)} className="flex-1 rounded-xl bg-slate-100 p-3 font-bold">취소</button><button disabled={saving} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 p-3 font-bold text-white disabled:opacity-50">{saving ? '저장 중...' : '저장하기'} <ExternalLink size={16} /></button></div>
    </form></div></div>}
  </div>;
}
