'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { collection, onSnapshot, Timestamp } from 'firebase/firestore';
import { ArrowRight, FolderKanban, Loader2, Search, Trash2, Users } from 'lucide-react';
import { db } from '@/lib/firebase';
import { deleteProjectWithRelatedData } from '@/lib/deleteProject';
import { useAuthStore } from '@/store/useAuthStore';

interface ProjectSummary {
  id: string;
  menteeId: string;
  title: string;
  currentStep: number;
  updatedAt?: Timestamp;
}

interface UserSummary {
  displayName?: string | null;
  email?: string;
}

function formatTimestamp(value?: Timestamp) {
  if (!value?.toDate) return '업데이트 기록 없음';
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(value.toDate());
}

export default function MentorDashboardPage() {
  const router = useRouter();
  const { role, loading: authLoading } = useAuthStore();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [users, setUsers] = useState<Record<string, UserSummary>>({});
  const [search, setSearch] = useState('');
  const [dataLoading, setDataLoading] = useState(true);
  const [deletingId, setDeletingId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && role !== 'mentor') router.replace('/');
  }, [authLoading, role, router]);

  useEffect(() => {
    if (role !== 'mentor') return;
    let projectsReady = false;
    let usersReady = false;
    const finishLoading = () => {
      if (projectsReady && usersReady) setDataLoading(false);
    };

    const unsubscribeProjects = onSnapshot(collection(db, 'projects'), (snapshot) => {
      const nextProjects = snapshot.docs.map((projectDoc) => {
        const data = projectDoc.data();
        return {
          id: projectDoc.id,
          menteeId: String(data.menteeId ?? data.userId ?? ''),
          title: String(data.title ?? data.initialIdea ?? '제목 없는 프로젝트'),
          currentStep: Number(data.currentStep ?? 1),
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt : undefined,
        };
      });
      nextProjects.sort((a, b) => (b.updatedAt?.toMillis() ?? 0) - (a.updatedAt?.toMillis() ?? 0));
      setProjects(nextProjects);
      projectsReady = true;
      finishLoading();
    });

    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(Object.fromEntries(snapshot.docs.map((userDoc) => [userDoc.id, userDoc.data() as UserSummary])));
      usersReady = true;
      finishLoading();
    });

    return () => {
      unsubscribeProjects();
      unsubscribeUsers();
    };
  }, [role]);

  const filteredProjects = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return projects;
    return projects.filter((project) => {
      const mentee = users[project.menteeId];
      return [project.title, mentee?.displayName, mentee?.email]
        .some((value) => value?.toLowerCase().includes(keyword));
    });
  }, [projects, search, users]);

  const deleteProject = async (project: ProjectSummary) => {
    if (!window.confirm(`'${project.title}' 프로젝트를 삭제하시겠습니까?\n멘티의 최종 사업계획서와 멘토 피드백도 함께 삭제되며 복구할 수 없습니다.`)) return;
    setDeletingId(project.id);
    setError('');
    try {
      await deleteProjectWithRelatedData(project.id);
    } catch (deleteError) {
      console.error('프로젝트 삭제 실패:', deleteError);
      setError('프로젝트를 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setDeletingId('');
    }
  };

  if (authLoading || (role === 'mentor' && dataLoading)) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={36} /></div>;
  }
  if (role !== 'mentor') return null;

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 text-xs font-black uppercase tracking-[0.25em] text-blue-600">Mentor Control Center</p>
            <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">멘티 프로젝트 통합 대시보드</h1>
            <p className="mt-3 text-sm font-medium text-slate-500">모든 사업계획서의 진행 단계와 최근 변경 사항을 실시간으로 확인합니다.</p>
          </div>
          <div className="flex gap-3">
            <div className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-3 text-blue-700"><Users className="mr-2 inline" size={18} /><strong>{new Set(projects.map((item) => item.menteeId)).size}</strong> 멘티</div>
            <div className="rounded-2xl bg-slate-900 px-5 py-3 text-white"><FolderKanban className="mr-2 inline" size={18} /><strong>{projects.length}</strong> 프로젝트</div>
          </div>
        </header>

        <div className="relative mb-5">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={19} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="멘티 이름, 이메일 또는 아이템 이름 검색" className="w-full rounded-2xl border border-slate-200 bg-white py-4 pl-12 pr-4 text-sm font-semibold outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
        </div>
        {error && <p className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</p>}

        <div className="hidden overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm md:block">
          <table className="w-full text-left">
            <thead className="bg-slate-900 text-xs uppercase tracking-wider text-slate-300">
              <tr><th className="px-6 py-4">멘티</th><th className="px-6 py-4">아이템 이름</th><th className="px-6 py-4">현재 단계</th><th className="px-6 py-4">최종 업데이트</th><th className="px-6 py-4"><span className="sr-only">상세 보기</span></th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProjects.map((project) => {
                const mentee = users[project.menteeId];
                return (
                  <tr key={project.id} onClick={() => router.push(`/admin/projects/${project.id}`)} className="cursor-pointer transition hover:bg-blue-50/60">
                    <td className="px-6 py-5"><p className="font-black text-slate-900">{mentee?.displayName || '이름 미등록'}</p><p className="mt-1 text-xs text-slate-500">{mentee?.email || '이메일 미등록'}</p></td>
                    <td className="px-6 py-5 font-bold text-slate-700">{project.title}</td>
                    <td className="px-6 py-5"><span className="rounded-full bg-blue-100 px-3 py-1.5 text-xs font-black text-blue-700">STEP {project.currentStep} / 7</span></td>
                    <td className="px-6 py-5 text-sm text-slate-500">{formatTimestamp(project.updatedAt)}</td>
                    <td className="px-6 py-5"><div className="flex items-center justify-end gap-2"><button type="button" onClick={(event) => { event.stopPropagation(); void deleteProject(project); }} disabled={Boolean(deletingId)} aria-label={`${project.title} 프로젝트 삭제`} className="rounded-xl p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40">{deletingId === project.id ? <Loader2 className="animate-spin" size={18} /> : <Trash2 size={18} />}</button><ArrowRight className="text-blue-600" size={18} /></div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="grid gap-4 md:hidden">
          {filteredProjects.map((project) => {
            const mentee = users[project.menteeId];
            return <div key={project.id} className="relative rounded-3xl border border-slate-200 bg-white shadow-sm"><Link href={`/admin/projects/${project.id}`} className="block p-5 pr-16"><div className="mb-4 flex items-start justify-between"><div><p className="font-black text-slate-950">{mentee?.displayName || '이름 미등록'}</p><p className="text-xs text-slate-500">{mentee?.email || '이메일 미등록'}</p></div><span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-blue-700">STEP {project.currentStep}</span></div><h2 className="text-lg font-black text-slate-800">{project.title}</h2><p className="mt-3 text-xs text-slate-400">{formatTimestamp(project.updatedAt)}</p></Link><button type="button" onClick={() => void deleteProject(project)} disabled={Boolean(deletingId)} aria-label={`${project.title} 프로젝트 삭제`} className="absolute bottom-4 right-4 rounded-xl p-2.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40">{deletingId === project.id ? <Loader2 className="animate-spin" size={18} /> : <Trash2 size={18} />}</button></div>;
          })}
        </div>

        {filteredProjects.length === 0 && <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-white py-20 text-center font-bold text-slate-400">표시할 프로젝트가 없습니다.</div>}
      </div>
    </div>
  );
}
