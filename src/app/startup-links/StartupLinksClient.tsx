'use client';

import { useEffect, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { ArrowRight, Check, Copy, ExternalLink, Link2, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { db } from '@/lib/firebase';
import { DEFAULT_STARTUP_LINKS, isSafeExternalUrl, STARTUP_LINK_CATEGORIES, type StartupLink } from '@/lib/startupLinks';
import { useAuthStore } from '@/store/useAuthStore';

type LinkOverride = Partial<Omit<StartupLink, 'id'>> & { id: string };
type LinkDraft = Pick<StartupLink, 'title' | 'url' | 'category' | 'description'>;

const emptyDraft: LinkDraft = { title: '', url: '', category: STARTUP_LINK_CATEGORIES[0], description: '' };

export default function StartupLinksClient() {
  const { role, user } = useAuthStore();
  const canManage = role === 'mentor' && !!user;
  const [overrides, setOverrides] = useState<LinkOverride[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('전체');
  const [editing, setEditing] = useState<StartupLink | null>(null);
  const [draft, setDraft] = useState<LinkDraft>(emptyDraft);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    return onSnapshot(collection(db, 'startup_links'), snapshot => {
      setOverrides(snapshot.docs.map(item => ({ id: item.id, ...item.data() })));
      setLoadError(false);
    }, () => setLoadError(true));
  }, []);

  const byId = new Map<string, StartupLink>(DEFAULT_STARTUP_LINKS.map(link => [link.id, link]));
  for (const override of overrides) {
    const original = byId.get(override.id);
    if (original) {
      byId.set(override.id, { ...original, ...override });
    } else if (override.title && override.url && override.category) {
      byId.set(override.id, {
        id: override.id,
        title: override.title,
        url: override.url,
        category: override.category,
        description: override.description || '',
        order: typeof override.order === 'number' ? override.order : DEFAULT_STARTUP_LINKS.length,
        hidden: override.hidden,
      });
    }
  }
  const allLinks = [...byId.values()].sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, 'ko'));
  const visibleLinks = allLinks.filter(link => !link.hidden && isSafeExternalUrl(link.url));
  const hiddenDefaults = allLinks.filter(link => link.hidden && DEFAULT_STARTUP_LINKS.some(item => item.id === link.id));
  const categories = [...new Set([...STARTUP_LINK_CATEGORIES, ...visibleLinks.map(link => link.category)])];
  const search = query.trim().toLocaleLowerCase();
  const filteredLinks = visibleLinks.filter(link =>
    (category === '전체' || link.category === category) &&
    (!search || `${link.title} ${link.description} ${link.category}`.toLocaleLowerCase().includes(search))
  );

  const openForm = (link?: StartupLink) => {
    setEditing(link || null);
    setDraft(link ? { title: link.title, url: link.url, category: link.category, description: link.description } : emptyDraft);
    setFormError('');
    setFormOpen(true);
  };

  const saveLink = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canManage || saving) return;
    const next = {
      title: draft.title.trim(),
      url: draft.url.trim(),
      category: draft.category.trim(),
      description: draft.description.trim(),
    };
    if (!next.title || !next.category || !isSafeExternalUrl(next.url)) {
      setFormError('제목, 분류, http 또는 https로 시작하는 링크 주소를 확인해 주세요.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      if (editing) {
        await setDoc(doc(db, 'startup_links', editing.id), next, { merge: true });
      } else {
        await addDoc(collection(db, 'startup_links'), {
          ...next,
          order: Math.max(-1, ...allLinks.map(link => link.order)) + 1,
        });
      }
      setFormOpen(false);
    } catch {
      setFormError('저장하지 못했습니다. 관리자 로그인 상태와 연결을 확인해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  const removeLink = async (link: StartupLink) => {
    if (!canManage || !window.confirm(`“${link.title}” 링크를 목록에서 삭제할까요?`)) return;
    try {
      if (DEFAULT_STARTUP_LINKS.some(item => item.id === link.id)) {
        await setDoc(doc(db, 'startup_links', link.id), { hidden: true }, { merge: true });
      } else {
        await deleteDoc(doc(db, 'startup_links', link.id));
      }
    } catch {
      window.alert('링크를 삭제하지 못했습니다. 다시 시도해 주세요.');
    }
  };

  const restoreLink = async (link: StartupLink) => {
    if (!canManage) return;
    try {
      await setDoc(doc(db, 'startup_links', link.id), { hidden: false }, { merge: true });
    } catch {
      window.alert('링크를 복원하지 못했습니다. 다시 시도해 주세요.');
    }
  };

  const copyPageUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.alert('주소를 복사하지 못했습니다. 브라우저 주소창의 주소를 복사해 주세요.');
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <section className="relative overflow-hidden bg-slate-950 px-4 pb-16 pt-14 text-white sm:pb-20 sm:pt-20">
        <div className="absolute -right-20 -top-24 h-80 w-80 rounded-full bg-blue-600/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-indigo-500/15 blur-3xl" />
        <div className="relative mx-auto max-w-6xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-400/25 bg-blue-400/10 px-4 py-2 text-xs font-bold tracking-wide text-blue-200">
            <Link2 size={15} /> EDUREPORT LINK LIBRARY
          </div>
          <h1 className="max-w-3xl text-4xl font-black leading-tight tracking-tight sm:text-6xl">창업가를 위한<br /><span className="text-blue-400">추천 링크 모음</span></h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">창업 정보와 사람, 실무 자료를 연결하는 공간입니다. 필요한 주제를 골라 바로 방문해 보세요.</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button type="button" onClick={copyPageUrl} className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-900/30 transition hover:bg-blue-500">
              {copied ? <Check size={17} /> : <Copy size={17} />}{copied ? '주소 복사 완료' : '이 페이지 주소 복사'}
            </button>
            <span className="text-sm text-slate-400">카카오톡으로 공유해 보세요</span>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="relative -mt-7 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-900/5 sm:p-5 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="찾고 싶은 주제나 링크 검색" aria-label="추천 링크 검색" className="w-full rounded-2xl bg-slate-50 py-3.5 pl-12 pr-4 text-sm font-medium outline-none ring-blue-500 transition focus:ring-2" />
          </div>
          {canManage && <button type="button" onClick={() => openForm()} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3.5 text-sm font-bold text-white hover:bg-slate-800"><Plus size={18} /> 새 링크 추가</button>}
        </div>

        {loadError && <p className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">저장된 변경사항을 불러오지 못했습니다. 기본 링크를 표시하고 있습니다.</p>}

        <div className="mt-9 flex flex-wrap gap-2" aria-label="링크 분류">
          {['전체', ...categories].map(item => (
            <button key={item} type="button" onClick={() => setCategory(item)} className={`rounded-full px-4 py-2.5 text-sm font-bold transition ${category === item ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-600'}`}>{item}</button>
          ))}
        </div>

        <div className="mt-9 space-y-12">
          {categories.filter(item => category === '전체' || category === item).map(item => {
            const links = filteredLinks.filter(link => link.category === item);
            if (!links.length) return null;
            return <section key={item} aria-labelledby={`category-${categories.indexOf(item)}`}>
              <div className="mb-5 flex items-end justify-between gap-3 border-b border-slate-200 pb-4">
                <div><p className="mb-1 text-xs font-black uppercase tracking-[0.2em] text-blue-600">CURATED LINKS</p><h2 id={`category-${categories.indexOf(item)}`} className="text-2xl font-black tracking-tight sm:text-3xl">{item}</h2></div>
                <span className="shrink-0 text-sm font-bold text-slate-400">{links.length}개 링크</span>
              </div>
              <div className="space-y-3">
                {links.map(link => {
                  const host = new URL(link.url).hostname.replace(/^www\./, '');
                  return <article key={link.id} className="group flex items-center rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-blue-300 hover:shadow-md">
                    <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 flex-1 items-center gap-3 px-4 py-4 sm:gap-5 sm:px-5" aria-label={`${link.title} 새 창에서 열기`}>
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Link2 size={19} /></span>
                      <span className="min-w-0 flex-1"><span className="block font-black leading-snug text-slate-900">{link.title}</span>{link.description && <span className="mt-1 block text-sm leading-5 text-slate-500">{link.description}</span>}</span>
                      <span className="hidden max-w-48 truncate text-sm font-bold text-blue-600 sm:block">{host}</span><ArrowRight size={18} className="shrink-0 text-blue-600 transition group-hover:translate-x-1" />
                    </a>
                    {canManage && <div className="flex shrink-0 gap-1 pr-3"><button type="button" onClick={() => openForm(link)} aria-label={`${link.title} 수정`} className="rounded-lg p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600"><Pencil size={16} /></button><button type="button" onClick={() => void removeLink(link)} aria-label={`${link.title} 삭제`} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button></div>}
                  </article>;
                })}
              </div>
            </section>;
          })}
        </div>

        {filteredLinks.length === 0 && <div className="mt-12 rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center"><Search size={28} className="mx-auto text-slate-300" /><p className="mt-4 font-bold text-slate-700">검색 결과가 없습니다.</p><p className="mt-2 text-sm text-slate-500">다른 검색어나 분류를 선택해 보세요.</p></div>}

        {canManage && hiddenDefaults.length > 0 && <section className="mt-14 rounded-3xl border border-slate-200 bg-white p-5 sm:p-7"><h2 className="text-lg font-black">목록에서 삭제한 기본 링크</h2><p className="mt-1 text-sm text-slate-500">필요할 때 다시 표시할 수 있습니다.</p><div className="mt-4 flex flex-wrap gap-2">{hiddenDefaults.map(link => <button key={link.id} type="button" onClick={() => void restoreLink(link)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 hover:border-blue-300 hover:text-blue-600">{link.title} 복원</button>)}</div></section>}

        <p className="mt-16 text-center text-xs leading-5 text-slate-400">외부 사이트의 내용과 운영 상태는 각 사이트에서 확인해 주세요.</p>
      </div>

      {formOpen && canManage && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/65 p-4" onMouseDown={event => { if (event.target === event.currentTarget && !saving) setFormOpen(false); }}>
        <div role="dialog" aria-modal="true" aria-labelledby="link-form-title" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
          <div className="flex items-center justify-between gap-4"><h2 id="link-form-title" className="text-2xl font-black">{editing ? '링크 수정' : '새 링크 추가'}</h2><button type="button" onClick={() => setFormOpen(false)} aria-label="닫기" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={20} /></button></div>
          <form onSubmit={saveLink} className="mt-6 space-y-4">
            <label className="block text-sm font-bold">링크 이름<input value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} maxLength={100} required className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-medium outline-none focus:border-blue-500" placeholder="예: 창업정보 뉴스레터" /></label>
            <label className="block text-sm font-bold">주소<input value={draft.url} onChange={event => setDraft({ ...draft, url: event.target.value })} type="url" required className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-medium outline-none focus:border-blue-500" placeholder="https://example.com" /></label>
            <label className="block text-sm font-bold">분류<input list="startup-link-categories" value={draft.category} onChange={event => setDraft({ ...draft, category: event.target.value })} maxLength={50} required className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-medium outline-none focus:border-blue-500" /><datalist id="startup-link-categories">{categories.map(item => <option key={item} value={item} />)}</datalist></label>
            <label className="block text-sm font-bold">간단한 설명<textarea value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} maxLength={200} rows={3} className="mt-2 w-full resize-none rounded-xl border border-slate-200 px-4 py-3 font-medium outline-none focus:border-blue-500" placeholder="방문자가 알면 좋은 내용을 적어 주세요." /></label>
            {formError && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{formError}</p>}
            <button type="submit" disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3.5 font-bold text-white hover:bg-blue-700 disabled:opacity-50">{saving ? '저장 중...' : editing ? '변경사항 저장' : '링크 추가'} <ExternalLink size={16} /></button>
          </form>
        </div>
      </div>}
    </div>
  );
}
