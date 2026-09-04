'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
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
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Copy,
  Download,
  FilePlus2,
  Lightbulb,
  Loader2,
  MessageSquareText,
  Save,
  Sparkles,
} from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { BUSINESS_CHECKLIST_GROUPS, RESULT_CHECKLIST_GROUPS } from '@/lib/mentorChecklists';
import { useAuthStore } from '@/store/useAuthStore';

const STEPS = [
  { number: 1, name: '초기 아이디어', persona: '기초 사업 가설 구조화' },
  { number: 2, name: '문제 정의', persona: '디자인 리서처 · 린 경영학자' },
  { number: 3, name: '실현 가능성', persona: '린 스타트업 · 구독 모델 전문가' },
  { number: 4, name: '성장 전략', persona: '마케팅 총괄 · VRIO 전략가' },
  { number: 5, name: '팀 구성', persona: '수석 헤드헌터 · 문화책임자' },
  { number: 6, name: '심사위원단 검증', persona: '정부지원사업 5인 심사위원단' },
  { number: 7, name: '최종 수정', persona: '최종 사업계획서 편집자' },
];

const DEEP_QUESTIONS: Record<number, string[]> = {
  1: ['누가 이 문제로 가장 절실하게 고통받고 있나요?', '현재 고객은 이 문제를 어떻게 해결하고 있나요?'],
  2: ['이 문제가 해결되지 않을 때 고객이 치르는 비용은 무엇인가요?', '직접 확인한 고객의 말이나 행동이 있나요?'],
  3: ['가장 먼저 검증해야 할 핵심 기능은 무엇인가요?', '고객이 실제로 비용을 지불할 기준은 무엇인가요?'],
  4: ['경쟁사가 쉽게 복제할 수 없는 자원은 무엇인가요?', '첫 100명의 고객을 어디에서 만날 수 있나요?'],
  5: ['대표자와 팀이 이미 증명한 실제 성과는 무엇인가요?', '현재 팀에서 가장 시급한 역량 공백은 무엇인가요?'],
  6: ['심사위원에게 가장 공격받기 쉬운 가정은 무엇인가요?', '반드시 합격해야 하는 평가 항목은 무엇인가요?'],
  7: ['멘토와 심사위원 지적 중 최우선 보완점은 무엇인가요?', '최종 제출 전에 확보할 증빙자료는 무엇인가요?'],
};

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
  userInput: string;
  aiOutput: string;
  qaAnswers: string[];
}

interface FeedbackData {
  mentorComment?: string;
  stepNumber?: number;
  businessChecklist?: Record<string, boolean>;
  resultChecklist?: Record<string, boolean>;
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
  answersByStep,
}: {
  project: ProjectData;
  results: Record<number, StepResult>;
  feedback: FeedbackData | null;
  activeStep: number;
  activeDraft: string;
  answersByStep: Record<number, string[]>;
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
    const stepAnswers = step.number === activeStep
      ? answersByStep[step.number] ?? result?.qaAnswers ?? []
      : result?.qaAnswers ?? [];
    const output = step.number === activeStep && activeDraft.trim()
      ? activeDraft.trim()
      : result?.aiOutput?.trim();

    lines.push(`## Step ${step.number}. ${step.name}`, '', `> 전문가: ${step.persona}`, '', '### 심화 Q&A', '');
    DEEP_QUESTIONS[step.number].forEach((question, index) => {
      lines.push(`${index + 1}. **${question}**`, '', stepAnswers[index]?.trim() || '_작성하지 않음_', '');
    });
    if (!result?.qaAnswers?.length && result?.userInput?.trim() && step.number !== activeStep) {
      lines.push('#### 저장된 추가 요청', '', result.userInput.trim(), '');
    }
    lines.push('### 생성 및 편집된 최종 초안', '', output || '_아직 생성하거나 저장한 초안이 없습니다._', '', '---', '');
  }

  const businessItems = BUSINESS_CHECKLIST_GROUPS.flatMap((group) => group.items);
  const resultItems = RESULT_CHECKLIST_GROUPS.flatMap((group) => group.items);
  lines.push('## 멘토 검증 피드백', '', '### 멘토 코멘트', '', feedback?.mentorComment?.trim() || '_아직 등록된 멘토 코멘트가 없습니다._', '', '### 사업 검증 체크리스트', '');
  businessItems.forEach((item) => lines.push(`- [${feedback?.businessChecklist?.[item.id] ? 'x' : ' '}] ${item.label}`));
  lines.push('', '### 결과 검증 체크리스트', '');
  resultItems.forEach((item) => lines.push(`- [${feedback?.resultChecklist?.[item.id] ? 'x' : ' '}] ${item.label}`));
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
  const allItems = [...BUSINESS_CHECKLIST_GROUPS, ...RESULT_CHECKLIST_GROUPS].flatMap((group) => group.items);
  const states = { ...feedback?.businessChecklist, ...feedback?.resultChecklist };
  const checkedItems = allItems.filter((item) => states[item.id]);

  return (
    <section className="overflow-hidden rounded-3xl border border-amber-200 bg-white shadow-sm">
      <button onClick={() => setOpen((value) => !value)} className="flex w-full items-center justify-between bg-amber-50 p-5 text-left"><div><p className="text-xs font-black uppercase tracking-wider text-amber-700">Mentor Feedback</p><h2 className="mt-1 font-black text-slate-950">실시간 멘토 점검</h2></div>{open ? <ChevronUp /> : <ChevronDown />}</button>
      {open && <div className="space-y-5 p-5"><div className="rounded-2xl bg-slate-950 p-4 text-sm leading-6 text-slate-200"><MessageSquareText className="mb-2 text-amber-400" size={20} />{feedback?.mentorComment || '아직 등록된 멘토 코멘트가 없습니다.'}</div><div><div className="mb-3 flex items-center justify-between text-sm"><strong>체크리스트 점검</strong><span className="font-black text-blue-600">{checkedItems.length} / {allItems.length}</span></div><div className="max-h-72 space-y-2 overflow-y-auto pr-1">{checkedItems.map((item) => <div key={item.id} className="flex gap-2 rounded-xl bg-blue-50 p-3 text-xs font-semibold leading-5 text-blue-950"><Check className="mt-0.5 shrink-0 text-blue-600" size={14} />{item.label}</div>)}{checkedItems.length === 0 && <p className="rounded-xl bg-slate-50 p-4 text-center text-xs font-bold text-slate-400">점검 완료된 항목이 없습니다.</p>}</div></div></div>}
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
  const [draft, setDraft] = useState('');
  const [deepAnswers, setDeepAnswers] = useState<Record<number, string[]>>({});
  const [loading, setLoading] = useState(Boolean(projectId));
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && role === 'mentor') router.replace('/admin/dashboard');
  }, [authLoading, role, router]);

  useEffect(() => {
    initializedRef.current = false;
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
      snapshot.docs.forEach((resultDoc) => {
        const data = resultDoc.data();
        const stepNumber = Number(data.stepNumber ?? data.step_number ?? 0);
        if (stepNumber >= 1 && stepNumber <= 7) nextResults[stepNumber] = {
          id: resultDoc.id,
          stepNumber,
          userInput: String(data.userInput ?? data.user_input ?? ''),
          aiOutput: String(data.aiOutput ?? data.ai_output ?? ''),
          qaAnswers: Array.isArray(data.qaAnswers) ? data.qaAnswers.map(String) : [],
        };
      });
      setResults(nextResults);
      const activeResult = nextResults[activeStepRef.current];
      setDraft(activeResult?.aiOutput ?? '');
      setDeepAnswers((current) => ({ ...current, [activeStepRef.current]: activeResult?.qaAnswers.length ? activeResult.qaAnswers : current[activeStepRef.current] ?? [] }));
    });
    const unsubscribeFeedback = onSnapshot(doc(db, 'mentor_feedbacks', projectId), (snapshot) => setFeedback(snapshot.exists() ? snapshot.data() as FeedbackData : null));
    return () => { unsubscribeProject(); unsubscribeResults(); unsubscribeFeedback(); };
  }, [projectId, role, user]);

  const userInput = useMemo(() => (deepAnswers[activeStep] ?? []).map((answer, index) => `${DEEP_QUESTIONS[activeStep][index]}\n${answer}`).filter((entry) => !entry.endsWith('\n')).join('\n\n'), [activeStep, deepAnswers]);
  const maxAccessibleStep = Math.min(7, Math.max(project?.currentStep ?? 1, ...Object.keys(results).map(Number)) + 1);

  const selectStep = (step: number) => {
    if (step > maxAccessibleStep) return;
    activeStepRef.current = step;
    setActiveStep(step);
    setDraft(results[step]?.aiOutput ?? '');
    const savedAnswers = results[step]?.qaAnswers;
    if (savedAnswers?.length && !(deepAnswers[step]?.length)) setDeepAnswers((current) => ({ ...current, [step]: savedAnswers }));
    setError('');
  };

  const generateDraft = async () => {
    if (!project || !auth.currentUser) return;
    setGenerating(true); setError('');
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/api/generate-step', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ projectId: project.id, currentStep: activeStep, userInput }) });
      const data = await response.json() as GenerateResponse;
      if (!response.ok || !data.success || !data.aiOutput) throw new Error(data.error || 'AI 초안 생성에 실패했습니다.');
      await setDoc(doc(db, 'step_results', `${project.id}_step_${activeStep}`), { qaAnswers: deepAnswers[activeStep] ?? [] }, { merge: true });
      setDraft(data.aiOutput);
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : 'AI 초안 생성 중 오류가 발생했습니다.');
    } finally { setGenerating(false); }
  };

  const saveAndContinue = async () => {
    if (!project || !draft.trim()) { setError('저장할 초안 내용을 입력해 주세요.'); return; }
    setSaving(true); setError('');
    try {
      await setDoc(doc(db, 'step_results', `${project.id}_step_${activeStep}`), { projectId: project.id, stepNumber: activeStep, userInput, qaAnswers: deepAnswers[activeStep] ?? [], aiOutput: draft.trim(), updatedAt: serverTimestamp() }, { merge: true });
      await updateDoc(doc(db, 'projects', project.id), { currentStep: Math.max(project.currentStep, Math.min(7, activeStep + 1)), updatedAt: serverTimestamp() });
      if (activeStep < 7) selectStep(activeStep + 1);
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
    answersByStep: deepAnswers,
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
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-black uppercase tracking-wider text-blue-600">{currentConfig.persona}</p><h2 className="mt-1 text-2xl font-black text-slate-950">{currentConfig.name}</h2></div><span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500">직접 편집 가능</span></div><textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={24} placeholder="AI 초안을 생성하거나 직접 사업계획서 내용을 작성하세요." className="w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm leading-7 text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100" /><div className="mt-2 text-right text-xs font-bold text-slate-400">{draft.length.toLocaleString()}자</div></section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><div className="mb-5 flex items-center gap-3"><div className="rounded-xl bg-amber-100 p-2 text-amber-700"><Lightbulb size={20} /></div><div><h2 className="font-black text-slate-950">선택형 심화 Q&A</h2><p className="text-xs text-slate-500">답변한 내용만 AI 생성과 다음 단계 컨텍스트에 반영됩니다.</p></div></div><div className="space-y-4">{DEEP_QUESTIONS[activeStep].map((question, index) => <label key={question} className="block"><span className="mb-2 block text-sm font-bold text-slate-700">{question} <span className="font-medium text-slate-400">(선택)</span></span><textarea value={deepAnswers[activeStep]?.[index] ?? ''} onChange={(event) => setDeepAnswers((current) => { const answers = [...(current[activeStep] ?? [])]; answers[index] = event.target.value; return { ...current, [activeStep]: answers }; })} rows={3} className="w-full resize-y rounded-2xl border border-slate-200 p-4 text-sm leading-6 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /></label>)}</div></section>

            {error && <div className="flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700"><AlertCircle className="shrink-0" size={19} />{error}</div>}
            <div className="flex flex-col gap-3 rounded-3xl bg-white p-4 shadow-sm sm:flex-row"><button onClick={generateDraft} disabled={generating || saving} className="flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-blue-600 px-5 py-4 font-black text-blue-700 transition hover:bg-blue-50 disabled:opacity-50">{generating ? <Loader2 className="animate-spin" /> : <Bot />} AI 초안 생성</button><button onClick={saveAndContinue} disabled={saving || generating || !draft.trim()} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-4 font-black text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 disabled:opacity-50">{saving ? <Loader2 className="animate-spin" /> : <Save />} {activeStep === 7 ? '최종 결과 저장' : '다음 단계로 저장 및 이동'}</button></div>
            {activeStep >= 6 && (draft.trim() || results[6]?.aiOutput) && <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 sm:p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-xs font-black uppercase tracking-wider text-emerald-700">Export Business Plan</p><h2 className="mt-1 text-xl font-black text-slate-950">사업계획서 결과물 내보내기</h2><p className="mt-2 text-sm text-slate-600">7단계 Q&A, 편집 초안, 멘토 코멘트와 체크리스트를 하나의 Markdown 문서로 정리합니다.</p></div><div className="flex flex-col gap-2 sm:flex-row"><button onClick={downloadBusinessPlan} className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3.5 text-sm font-black text-white transition hover:bg-emerald-800"><Download size={18} /> 사업계획서 파일 다운로드</button><button onClick={copyBusinessPlan} className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-300 bg-white px-5 py-3.5 text-sm font-black text-emerald-800 transition hover:bg-emerald-100">{copied ? <Check size={18} /> : <Copy size={18} />} {copied ? '복사 완료' : '전체 복사하기'}</button></div></div></section>}
          </main>
          <aside className="space-y-5 xl:sticky xl:top-24 xl:self-start"><FeedbackAccordion feedback={feedback} /><section className="rounded-3xl bg-slate-950 p-5 text-white"><Sparkles className="text-blue-400" /><h2 className="mt-3 font-black">자동 체이닝 작동 중</h2><p className="mt-2 text-xs leading-6 text-slate-400">저장한 편집본은 다음 단계 AI의 누적 컨텍스트로 자동 전달됩니다. Step 7에는 멘토 피드백도 함께 반영됩니다.</p></section></aside>
        </div>
      </div>
    </div>
  );
}

export default function AiWorkspacePage() {
  return <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={36} /></div>}><WorkspaceContent /></Suspense>;
}
