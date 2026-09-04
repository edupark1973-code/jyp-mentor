'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Copy,
  Download,
  FilePlus2,
  Loader2,
  MessageSquareText,
  Save,
  Sparkles,
} from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { useAuthStore } from '@/store/useAuthStore';

const STEPS = [
  { number: 1, name: '초기 아이디어', persona: '기초 사업 가설 구조화' },
  { number: 2, name: '문제 정의', persona: '디자인 씽킹' },
  { number: 3, name: '실현 가능성', persona: 'MVP & 초기고객 개발' },
  { number: 4, name: '성장 전략', persona: '마케팅 · 스케일업 ' },
  { number: 5, name: '팀 구성', persona: '팀빌딩 · 연계자원' },
  { number: 6, name: '최종 사업계획서', persona: '최종 사업계획서 편집자' },
  { number: 7, name: '심사위원 검증', persona: '5인 가상 심사위원단 · 참고용' },
];

interface ProjectData {
  id: string;
  title: string;
  initialIdea: string;
  currentStep: number;
  menteeId: string;
}

interface StepResult {
  id: string;
  stepNumber: number;
  aiOutput: string;
}

interface FeedbackData {
  mentorComment?: string;
  stepNumber?: number;
}

interface GenerateResponse {
  success?: boolean;
  aiOutput?: string;
  error?: string;
}

function buildExportMarkdown({
  project,
  results,
  feedback,
  activeStep,
  activeDraft,
}: {
  project: ProjectData;
  results: Record<number, StepResult>;
  feedback: FeedbackData | null;
  activeStep: number;
  activeDraft: string;
}) {
  const lines = [
    `# ${project.title}`,
    '',
    `- 프로젝트 ID: ${project.id}`,
    `- 내보낸 날짜: ${new Intl.DateTimeFormat('ko-KR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date())}`,
    '- 문서 형식: JYP Mentor AI 7단계 사업계획서',
    '',
    '## 초기 비즈니스 아이디어',
    '',
    project.initialIdea || '_입력된 초기 아이디어가 없습니다._',
    '',
    '---',
    '',
  ];

  for (const step of STEPS) {
    const result = results[step.number];
    const output = step.number === activeStep && activeDraft.trim()
      ? activeDraft.trim()
      : result?.aiOutput?.trim();

    lines.push(`## Step ${step.number}. ${step.name}`, '', `> 전문가: ${step.persona}`, '', output || '_아직 생성하거나 저장한 초안이 없습니다._', '', '---', '');
  }

  lines.push('## 멘토 피드백', '', feedback?.mentorComment?.trim() || '_아직 등록된 멘토 코멘트가 없습니다._');
  lines.push('', '---', '', '_본 문서는 JYP Mentor AI 사업계획서 워크스페이스에서 생성되었습니다._', '');

  return lines.join('\n');
}

async function copyToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.opacity = '0';
  document.body.appendChild(textArea);
  textArea.select();
  const copied = document.execCommand('copy');
  textArea.remove();
  if (!copied) throw new Error('클립보드 복사를 지원하지 않는 브라우저입니다.');
}

function ProjectEntry({ userId }: { userId: string }) {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [title, setTitle] = useState('');
  const [initialIdea, setInitialIdea] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const projectsQuery = query(collection(db, 'projects'), where('menteeId', '==', userId));
    return onSnapshot(projectsQuery, (snapshot) => {
      setProjects(snapshot.docs.map((projectDoc) => {
        const data = projectDoc.data();
        return {
          id: projectDoc.id,
          title: String(data.title ?? data.initialIdea ?? '제목 없는 프로젝트'),
          initialIdea: String(data.initialIdea ?? ''),
          currentStep: Number(data.currentStep ?? 1),
          menteeId: String(data.menteeId ?? ''),
        };
      }));
    });
  }, [userId]);

  const createProject = async () => {
    if (!title.trim() || !initialIdea.trim()) return;
    setCreating(true);
    try {
      const projectRef = await addDoc(collection(db, 'projects'), {
        menteeId: userId,
        title: title.trim(),
        initialIdea: initialIdea.trim(),
        currentStep: 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      router.replace(`/ai/workspace?projectId=${projectRef.id}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header className="mb-8"><p className="text-xs font-black uppercase tracking-[0.25em] text-blue-600">AI Business Plan Builder</p><h1 className="mt-2 text-3xl font-black text-slate-950 sm:text-4xl">내 사업계획서 워크스페이스</h1><p className="mt-3 text-slate-500">기존 프로젝트를 이어가거나 새로운 아이디어로 시작하세요.</p></header>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="flex items-center gap-2 text-xl font-black"><FilePlus2 className="text-blue-600" /> 새 프로젝트</h2><div className="mt-5 space-y-4"><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="사업 아이템 이름" className="w-full rounded-2xl border border-slate-200 px-4 py-3.5 font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /><textarea value={initialIdea} onChange={(event) => setInitialIdea(event.target.value)} rows={7} placeholder="누구의 어떤 문제를 어떻게 해결할 것인지 자유롭게 적어주세요." className="w-full resize-y rounded-2xl border border-slate-200 px-4 py-3.5 leading-7 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /><button onClick={createProject} disabled={creating || !title.trim() || !initialIdea.trim()} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 font-black text-white disabled:opacity-50">{creating ? <Loader2 className="animate-spin" /> : <Sparkles />} 7단계 기획 시작하기</button></div></section>
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-black">진행 중인 프로젝트</h2><div className="mt-5 space-y-3">{projects.map((project) => <Link key={project.id} href={`/ai/workspace?projectId=${project.id}`} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 p-4 transition hover:border-blue-200 hover:bg-blue-50"><div><p className="font-black text-slate-900">{project.title}</p><p className="mt-1 line-clamp-1 text-xs text-slate-500">{project.initialIdea}</p></div><div className="ml-4 flex shrink-0 items-center gap-2"><span className="rounded-full bg-white px-3 py-1 text-xs font-black text-blue-700">STEP {project.currentStep}</span><ChevronRight size={18} /></div></Link>)}{projects.length === 0 && <p className="py-16 text-center font-bold text-slate-400">아직 프로젝트가 없습니다.</p>}</div></section>
      </div>
    </div>
  );
}

function FeedbackAccordion({ feedback }: { feedback: FeedbackData | null }) {
  const [open, setOpen] = useState(true);

  return (
    <section className="overflow-hidden rounded-3xl border border-amber-200 bg-white shadow-sm">
      <button onClick={() => setOpen((value) => !value)} className="flex w-full items-center justify-between bg-amber-50 p-5 text-left"><div><p className="text-xs font-black uppercase tracking-wider text-amber-700">Mentor Feedback</p><h2 className="mt-1 font-black text-slate-950">실시간 멘토 코멘트</h2></div>{open ? <ChevronUp /> : <ChevronDown />}</button>
      {open && <div className="p-5"><div className="rounded-2xl bg-slate-950 p-4 text-sm leading-6 text-slate-200"><MessageSquareText className="mb-2 text-amber-400" size={20} />{feedback?.mentorComment || '아직 등록된 멘토 코멘트가 없습니다.'}</div></div>}
    </section>
  );
}

function WorkspaceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId');
  const { user, role, loading: authLoading } = useAuthStore();
  const [project, setProject] = useState<ProjectData | null>(null);
  const [results, setResults] = useState<Record<number, StepResult>>({});
  const [feedback, setFeedback] = useState<FeedbackData | null>(null);
  const [activeStep, setActiveStep] = useState(1);
  const activeStepRef = useRef(1);
  const initializedRef = useRef(false);
  const generatingStepRef = useRef<number | null>(null);
  const attemptedStepsRef = useRef(new Set<number>());
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(Boolean(projectId));
  const [resultsLoaded, setResultsLoaded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && role === 'mentor') router.replace('/admin/dashboard');
  }, [authLoading, role, router]);

  useEffect(() => {
    initializedRef.current = false;
    generatingStepRef.current = null;
    attemptedStepsRef.current.clear();
    setResultsLoaded(false);
    if (!projectId || !user || role !== 'mentee') return;
    setLoading(true);
    const projectRef = doc(db, 'projects', projectId);
    const unsubscribeProject = onSnapshot(projectRef, (snapshot) => {
      if (!snapshot.exists()) { setError('프로젝트를 찾을 수 없습니다.'); setLoading(false); return; }
      const data = snapshot.data();
      if (String(data.menteeId ?? '') !== user.uid) { setError('이 프로젝트에 접근할 권한이 없습니다.'); setLoading(false); return; }
      const nextProject = { id: snapshot.id, title: String(data.title ?? '제목 없는 프로젝트'), initialIdea: String(data.initialIdea ?? ''), currentStep: Number(data.currentStep ?? 1), menteeId: String(data.menteeId ?? '') };
      setProject(nextProject);
      if (!initializedRef.current) {
        const initialStep = Math.min(7, Math.max(1, nextProject.currentStep));
        activeStepRef.current = initialStep;
        setActiveStep(initialStep);
        initializedRef.current = true;
      }
      setLoading(false);
    });
    const resultsQuery = query(collection(db, 'step_results'), where('projectId', '==', projectId));
    const unsubscribeResults = onSnapshot(resultsQuery, (snapshot) => {
      const nextResults: Record<number, StepResult> = {};
      let legacyStep6: StepResult | undefined;
      let legacyStep7: StepResult | undefined;
      snapshot.docs.forEach((resultDoc) => {
        const data = resultDoc.data();
        const stepNumber = Number(data.stepNumber ?? data.step_number ?? 0);
        if (stepNumber >= 1 && stepNumber <= 7) {
          const result = {
          id: resultDoc.id,
          stepNumber,
          aiOutput: String(data.aiOutput ?? data.ai_output ?? ''),
          };
          const workflowVersion = Number(data.workflowVersion ?? 1);
          if (workflowVersion < 2 && stepNumber === 6) legacyStep6 = result;
          else if (workflowVersion < 2 && stepNumber === 7) legacyStep7 = result;
          else nextResults[stepNumber] = result;
        }
      });
      if (!nextResults[6] && legacyStep7) nextResults[6] = { ...legacyStep7, stepNumber: 6 };
      if (!nextResults[7] && legacyStep6) nextResults[7] = { ...legacyStep6, stepNumber: 7 };
      setResults(nextResults);
      const activeResult = nextResults[activeStepRef.current];
      setDraft(activeResult?.aiOutput ?? '');
      setResultsLoaded(true);
    });
    const unsubscribeFeedback = onSnapshot(doc(db, 'mentor_feedbacks', projectId), (snapshot) => setFeedback(snapshot.exists() ? snapshot.data() as FeedbackData : null));
    return () => { unsubscribeProject(); unsubscribeResults(); unsubscribeFeedback(); };
  }, [projectId, role, user]);

  const maxAccessibleStep = Math.min(7, Math.max(project?.currentStep ?? 1, ...Object.keys(results).map(Number)) + 1);

  const selectStep = (step: number) => {
    if (step > maxAccessibleStep) return;
    activeStepRef.current = step;
    setActiveStep(step);
    setDraft(results[step]?.aiOutput ?? '');
    setError('');
  };

  const generateStep = useCallback(async (step: number) => {
    if (!project || !auth.currentUser || generatingStepRef.current !== null) return;
    generatingStepRef.current = step;
    attemptedStepsRef.current.add(step);
    setGenerating(true); setError('');
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/api/generate-step', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ projectId: project.id, currentStep: step, userInput: '' }) });
      const responseText = await response.text();
      let data: GenerateResponse;
      try {
        data = JSON.parse(responseText) as GenerateResponse;
      } catch {
        throw new Error(`AI 서버가 정상 응답하지 않았습니다. 잠시 후 다시 시도해 주세요. (${response.status})`);
      }
      if (!response.ok || !data.success || !data.aiOutput) throw new Error(data.error || 'AI 초안 생성에 실패했습니다.');
      if (activeStepRef.current === step) setDraft(data.aiOutput);
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : 'AI 초안 생성 중 오류가 발생했습니다.');
    } finally {
      generatingStepRef.current = null;
      setGenerating(false);
    }
  }, [project]);

  useEffect(() => {
    if (!loading && resultsLoaded && project && !results[activeStep]?.aiOutput && generatingStepRef.current === null && !attemptedStepsRef.current.has(activeStep)) {
      void generateStep(activeStep);
    }
  }, [activeStep, generateStep, loading, project, results, resultsLoaded]);

  const saveAndContinue = async () => {
    if (!project || !draft.trim()) { setError('저장할 초안 내용을 입력해 주세요.'); return; }
    setSaving(true); setError('');
    try {
      await setDoc(doc(db, 'step_results', `${project.id}_step_${activeStep}`), { projectId: project.id, stepNumber: activeStep, userInput: '', qaAnswers: [], aiOutput: draft.trim(), workflowVersion: 2, updatedAt: serverTimestamp() }, { merge: true });
      await updateDoc(doc(db, 'projects', project.id), { currentStep: Math.max(project.currentStep, Math.min(7, activeStep + 1)), updatedAt: serverTimestamp() });
      if (activeStep < 7) {
        const nextStep = activeStep + 1;
        selectStep(nextStep);
        if (!results[nextStep]?.aiOutput) await generateStep(nextStep);
      }
      else alert('최종 사업계획서가 저장되었습니다.');
    } catch (saveError) {
      console.error('단계 저장 실패:', saveError);
      setError('초안 저장 중 오류가 발생했습니다.');
    } finally { setSaving(false); }
  };

  const getExportMarkdown = () => project ? buildExportMarkdown({
    project,
    results,
    feedback,
    activeStep,
    activeDraft: draft,
  }) : '';

  const downloadBusinessPlan = () => {
    if (!project) return;
    const markdown = getExportMarkdown().replace(/\n/g, '\r\n');
    const blob = new Blob([`\uFEFF${markdown}`], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const safeTitle = project.title.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').trim() || '사업계획서';
    anchor.href = url;
    anchor.download = `${safeTitle}_7단계_사업계획서.md`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const copyBusinessPlan = async () => {
    try {
      await copyToClipboard(getExportMarkdown());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (copyError) {
      setError(copyError instanceof Error ? copyError.message : '전체 복사에 실패했습니다.');
    }
  };

  if (authLoading) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={36} /></div>;
  if (!user) return <div className="mx-auto max-w-xl px-6 py-24 text-center"><AlertCircle className="mx-auto text-blue-600" size={42} /><h1 className="mt-5 text-2xl font-black">로그인이 필요합니다</h1><p className="mt-2 text-slate-500">상단 메뉴에서 로그인한 뒤 워크스페이스를 이용해 주세요.</p></div>;
  if (role !== 'mentee') return null;
  if (!projectId) return <ProjectEntry userId={user.uid} />;
  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={36} /></div>;
  if (!project) return <div className="mx-auto max-w-xl p-12 text-center font-bold text-red-600">{error || '프로젝트를 불러오지 못했습니다.'}</div>;

  const currentConfig = STEPS[activeStep - 1];
  return (
    <div className="min-h-screen bg-slate-100 px-3 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1680px]">
        <header className="mb-5 rounded-3xl bg-slate-950 p-5 text-white sm:p-7"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><Link href="/ai/workspace" className="text-xs font-black uppercase tracking-[0.2em] text-blue-400">AI Business Plan Builder</Link><h1 className="mt-2 text-2xl font-black sm:text-3xl">{project.title}</h1><p className="mt-2 text-sm text-slate-400">10%의 아이디어, 80%의 AI 초안, 마지막 10%는 창업가의 통찰로 완성하세요.</p></div><span className="w-fit rounded-full bg-blue-600 px-4 py-2 text-sm font-black">STEP {activeStep} / 7</span></div></header>

        <nav className="mb-5 overflow-x-auto rounded-3xl border border-slate-200 bg-white p-3 shadow-sm"><div className="flex min-w-max gap-2 lg:grid lg:min-w-0 lg:grid-cols-7">{STEPS.map((step) => { const complete = Boolean(results[step.number]?.aiOutput); const active = step.number === activeStep; const disabled = step.number > maxAccessibleStep; return <button key={step.number} disabled={disabled} onClick={() => selectStep(step.number)} className={`min-w-36 rounded-2xl p-3 text-left transition lg:min-w-0 ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : complete ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-50 text-slate-500'} disabled:cursor-not-allowed disabled:opacity-40`}><div className="flex items-center justify-between"><span className="text-xs font-black">STEP {step.number}</span>{complete && <Check size={15} />}</div><p className="mt-1 text-sm font-black">{step.name}</p></button>; })}</div></nav>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
          <main className="space-y-5">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-black uppercase tracking-wider text-blue-600">{currentConfig.persona}</p><h2 className="mt-1 text-2xl font-black text-slate-950">{currentConfig.name}</h2></div><span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500">{activeStep === 7 ? '최종안 검증 결과 · 읽기 전용' : 'AI 자동 생성 · 직접 편집 가능'}</span></div>{generating && !draft ? <div className="flex min-h-[36rem] flex-col items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-center"><Loader2 className="animate-spin text-blue-600" size={36} /><p className="mt-4 font-black text-blue-950">Step {activeStep} {activeStep === 7 ? '심사 보고서를' : '초안을'} 자동 생성하고 있습니다.</p><p className="mt-2 text-sm text-blue-700">잠시만 기다려 주세요.</p></div> : activeStep === 7 ? <div className="min-h-[36rem] whitespace-pre-wrap rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-slate-800">{draft || '심사위원 검증 결과를 준비하고 있습니다.'}</div> : <textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={24} placeholder="AI가 자동으로 생성한 초안이 여기에 표시됩니다." className="w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm leading-7 text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100" />}<div className="mt-2 text-right text-xs font-bold text-slate-400">{draft.length.toLocaleString()}자</div></section>

            {error && <div className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700 sm:flex-row sm:items-center"><div className="flex flex-1 gap-3"><AlertCircle className="shrink-0" size={19} />{error}</div>{!draft.trim() && !generating && <button onClick={() => { attemptedStepsRef.current.delete(activeStep); void generateStep(activeStep); }} className="rounded-xl border border-red-300 bg-white px-4 py-2 text-xs font-black hover:bg-red-100">자동 생성 다시 시도</button>}</div>}
            {activeStep < 7 ? <div className="rounded-3xl bg-white p-4 shadow-sm"><button onClick={saveAndContinue} disabled={saving || generating || !draft.trim()} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-4 font-black text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 disabled:opacity-50">{saving || generating ? <Loader2 className="animate-spin" /> : <Save />} {saving ? '저장 후 다음 단계 AI 생성 중' : activeStep === 6 ? '최종안 확정 후 심사위원 검증' : 'AI 적용 후 다음 단계로 이동'}</button></div> : <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-center"><p className="font-black text-amber-900">사업계획서 작성 및 심사위원 검증이 완료되었습니다.</p><p className="mt-1 text-sm text-amber-700">위 검증 내용은 제출 전 보완 여부를 판단하기 위한 참고 자료입니다.</p></div>}
            {activeStep >= 6 && (draft.trim() || results[6]?.aiOutput) && <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 sm:p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-xs font-black uppercase tracking-wider text-emerald-700">Export Business Plan</p><h2 className="mt-1 text-xl font-black text-slate-950">사업계획서 결과물 내보내기</h2><p className="mt-2 text-sm text-slate-600">Step 6 최종 사업계획서를 본문으로, Step 7 심사 결과를 참고 부록으로 정리합니다.</p></div><div className="flex flex-col gap-2 sm:flex-row"><button onClick={downloadBusinessPlan} className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3.5 text-sm font-black text-white transition hover:bg-emerald-800"><Download size={18} /> 사업계획서 파일 다운로드</button><button onClick={copyBusinessPlan} className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-300 bg-white px-5 py-3.5 text-sm font-black text-emerald-800 transition hover:bg-emerald-100">{copied ? <Check size={18} /> : <Copy size={18} />} {copied ? '복사 완료' : '전체 복사하기'}</button></div></div></section>}
          </main>
          <aside className="space-y-5 xl:sticky xl:top-24 xl:self-start"><FeedbackAccordion feedback={feedback} /><section className="rounded-3xl bg-slate-950 p-5 text-white"><Sparkles className="text-blue-400" /><h2 className="mt-3 font-black">자동 체이닝 작동 중</h2><p className="mt-2 text-xs leading-6 text-slate-400">Step 6에서 편집·확정한 최종 사업계획서를 기준으로 Step 7의 읽기 전용 심사 참고 보고서가 자동 생성됩니다.</p></section></aside>
        </div>
      </div>
    </div>
  );
}

export default function AiWorkspacePage() {
  return <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={36} /></div>}><WorkspaceContent /></Suspense>;
}
