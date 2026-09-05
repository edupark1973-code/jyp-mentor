'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { collection, deleteField, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { ArrowLeft, ChevronDown, ChevronUp, Loader2, Mail, Plus, Save, Clock } from 'lucide-react';
import { db } from '@/lib/firebase';
import { sendMentorFeedbackNotification } from '@/lib/notifications';
import MarkdownDocument from '@/components/MarkdownDocument';
import { useAuthStore } from '@/store/useAuthStore';

interface ProjectDetail {
  id: string;
  menteeId: string;
  title: string;
  currentStep: number;
}

interface MenteeDetail {
  displayName: string;
  email: string;
}

interface StepResult {
  id: string;
  stepNumber: number;
  aiOutput: string;
}

interface CommentItem {
  id: string;
  content: string;
  createdAt?: any;
}

export default function MentorProjectDetailPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, role, loading: authLoading } = useAuthStore();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [mentee, setMentee] = useState<MenteeDetail | null>(null);
  const [steps, setSteps] = useState<StepResult[]>([]);
  const [openSteps, setOpenSteps] = useState<Record<number, boolean>>({});
  
  // 코멘트 이력 및 새 코멘트 입력 상태
  const [commentsHistory, setCommentsHistory] = useState<CommentItem[]>([]);
  const [newComment, setNewComment] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && role !== 'mentor') router.replace('/');
  }, [authLoading, role, router]);

  useEffect(() => {
    if (role !== 'mentor' || !projectId) return;
    const projectRef = doc(db, 'projects', projectId);
    const feedbackRef = doc(db, 'mentor_feedbacks', projectId);

    const unsubscribeProject = onSnapshot(projectRef, async (snapshot) => {
      if (!snapshot.exists()) {
        setError('프로젝트를 찾을 수 없습니다.');
        setLoading(false);
        return;
      }
      const data = snapshot.data();
      const nextProject: ProjectDetail = {
        id: snapshot.id,
        menteeId: String(data.menteeId ?? data.userId ?? ''),
        title: String(data.title ?? data.initialIdea ?? '제목 없는 프로젝트'),
        currentStep: Number(data.currentStep ?? 1),
      };
      setProject(nextProject);
      if (nextProject.menteeId) {
        const userSnapshot = await getDoc(doc(db, 'users', nextProject.menteeId));
        const userData = userSnapshot.data();
        setMentee({ displayName: String(userData?.displayName ?? '이름 미등록'), email: String(userData?.email ?? '') });
      }
      setLoading(false);
    }, () => {
      setError('프로젝트 정보를 불러오지 못했습니다.');
      setLoading(false);
    });

    const stepsQuery = query(collection(db, 'step_results'), where('projectId', '==', projectId));
    const unsubscribeSteps = onSnapshot(stepsQuery, (snapshot) => {
      let finalPlan: StepResult | undefined;
      let judgeReview: StepResult | undefined;
      let legacyStep6: StepResult | undefined;
      let legacyStep7: StepResult | undefined;

      snapshot.docs.forEach((stepDoc) => {
        const data = stepDoc.data();
        const stepNumber = Number(data.stepNumber ?? 0);
        if (stepNumber !== 6 && stepNumber !== 7) return;
        const result = { id: stepDoc.id, stepNumber, aiOutput: String(data.aiOutput ?? '') };
        const workflowVersion = Number(data.workflowVersion ?? 1);
        if (workflowVersion >= 2 && stepNumber === 6) finalPlan = result;
        else if (workflowVersion >= 2 && stepNumber === 7) judgeReview = result;
        else if (stepNumber === 6) legacyStep6 = result;
        else legacyStep7 = result;
      });

      if (!finalPlan && legacyStep7) finalPlan = { ...legacyStep7, stepNumber: 6 };
      if (!judgeReview && legacyStep6) judgeReview = { ...judgeReview, stepNumber: 7 };
      setSteps([finalPlan, judgeReview].filter((step): step is StepResult => Boolean(step)));
    });

    const unsubscribeFeedback = onSnapshot(feedbackRef, (snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.data();
      
      let history: CommentItem[] = [];
      if (Array.isArray(data.comments)) {
        history = data.comments;
      } else if (data.mentorComment) {
        // 기존 단일 코멘트 데이터 호환
        history = [{
          id: 'legacy',
          content: String(data.mentorComment),
          createdAt: data.updatedAt || null,
        }];
      }
      setCommentsHistory(history);
    });

    return () => {
      unsubscribeProject();
      unsubscribeSteps();
      unsubscribeFeedback();
    };
  }, [projectId, role]);

  const saveFeedback = async () => {
    if (!project || !mentee?.email || !user) {
      setError('프로젝트 또는 멘티 이메일 정보가 없어 저장할 수 없습니다.');
      return;
    }

    if (!newComment.trim()) {
      setError('새로 추가할 코멘트 내용을 입력해 주세요.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const newCommentObj = {
        id: Date.now().toString(),
        content: newComment.trim(),
        createdAt: new Date().toISOString(),
      };

      const updatedComments = [newCommentObj, ...commentsHistory];

      await setDoc(doc(db, 'mentor_feedbacks', project.id), {
        projectId: project.id,
        stepNumber: project.currentStep,
        mentorId: user.uid,
        mentorComment: newComment.trim(), // 최신 코멘트 유지
        comments: updatedComments, // 누적 코멘트 배열 저장
        businessChecklist: deleteField(),
        resultChecklist: deleteField(),
        updatedAt: serverTimestamp(),
      }, { merge: true });

      const mailResult = await sendMentorFeedbackNotification({
        menteeEmail: mentee.email,
        menteeName: mentee.displayName,
        projectTitle: project.title,
        stepName: '최종 사업계획서 검토',
        mentorCommentSummary: newComment.trim(),
        projectId: project.id,
      });

      setNewComment(''); // 입력창 초기화

      if (!mailResult.success) {
        setError('피드백은 저장됐지만 메일 큐 등록에 실패했습니다. 다시 시도해 주세요.');
        return;
      }
      alert('피드백 저장 및 메일 발송 등록이 완료되었습니다.');
    } catch (saveError) {
      console.error('멘토 피드백 저장 실패:', saveError);
      setError('피드백 저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={36} /></div>;
  if (role !== 'mentor') return null;
  if (!project) return <div className="mx-auto max-w-3xl p-10 text-center font-bold text-red-600">{error || '프로젝트를 찾을 수 없습니다.'}</div>;

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px]">
        <header className="mb-6 rounded-3xl bg-slate-950 p-6 text-white shadow-xl sm:p-8">
          <Link href="/admin/dashboard" className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-white"><ArrowLeft size={17} /> 통합 대시보드</Link>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div><p className="text-xs font-black uppercase tracking-[0.2em] text-blue-400">Project Review Room</p><h1 className="mt-2 text-3xl font-black">{project.title}</h1><p className="mt-3 text-sm text-slate-400">{mentee?.displayName} · {mentee?.email || '이메일 미등록'}</p></div>
            <span className="rounded-full bg-blue-600 px-4 py-2 text-sm font-black">STEP {project.currentStep} / 7</span>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_480px]">
          <main className="space-y-4">
            {steps.map((step) => {
              const isOpen = openSteps[step.stepNumber] ?? true;
              const isFinalPlan = step.stepNumber === 6;
              return <section key={`${step.id}-${step.stepNumber}`} className={`overflow-hidden rounded-3xl border bg-white shadow-sm ${isFinalPlan ? 'border-blue-200' : 'border-amber-200'}`}><button onClick={() => setOpenSteps((current) => ({ ...current, [step.stepNumber]: !isOpen }))} className={`flex w-full items-center justify-between p-5 text-left sm:p-6 ${isFinalPlan ? 'bg-blue-50' : 'bg-amber-50'}`}><div><span className={`text-xs font-black ${isFinalPlan ? 'text-blue-600' : 'text-amber-700'}`}>STEP {step.stepNumber}</span><h2 className="mt-1 text-lg font-black text-slate-900">{isFinalPlan ? '멘티 최종 사업계획서' : '가상 심사위원 검증 · 참고용'}</h2></div>{isOpen ? <ChevronUp /> : <ChevronDown />}</button>{isOpen && <div className="border-t border-slate-100 p-5 sm:p-6"><MarkdownDocument content={step.aiOutput || '생성된 결과가 없습니다.'} /></div>}</section>;
            })}
            {steps.length === 0 && <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-white px-6 py-20 text-center"><p className="font-black text-slate-500">아직 최종 검토 결과가 없습니다.</p><p className="mt-2 text-sm text-slate-400">멘티가 Step 6 최종 사업계획서를 완료하면 이곳에 표시됩니다.</p></div>}
          </main>

          <aside className="space-y-5 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto xl:pr-2">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xl sm:p-6">
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <Plus size={20} className="text-blue-600" /> 새 멘토 코멘트 추가
              </h2>
              <textarea 
                id="mentor-comment" 
                value={newComment} 
                onChange={(event) => setNewComment(event.target.value)} 
                rows={5} 
                placeholder="새로운 피드백이나 추가 개선 방향을 입력해 주세요. (줄바꿈 가능)" 
                className="mt-4 w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 font-medium whitespace-pre-wrap" 
              />
              {error && <p className="mt-3 text-sm font-bold text-red-600">{error}</p>}
              <button 
                onClick={saveFeedback} 
                disabled={saving || !mentee?.email || !newComment.trim()} 
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-4 font-black text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? <Loader2 className="animate-spin" size={19} /> : <><Save size={18} /><Mail size={18} /></>} 새 코멘트 저장 및 메일 발송
              </button>
            </section>

            {/* 이전 코멘트 이력 목록 */}
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-base font-black text-slate-950 flex items-center gap-2 mb-4">
                <Clock size={18} className="text-slate-500" /> 코멘트 이력 ({commentsHistory.length})
              </h2>
              
              {commentsHistory.length === 0 ? (
                <p className="text-xs text-slate-400 font-medium py-4 text-center">등록된 코멘트가 없습니다.</p>
              ) : (
                <div className="space-y-3">
                  {commentsHistory.map((item, index) => (
                    <div key={item.id || index} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="flex items-center justify-between text-xs text-slate-400 font-bold mb-2">
                        <span>멘토 피드백 #{commentsHistory.length - index}</span>
                        {item.createdAt && (
                          <span>
                            {typeof item.createdAt === 'string' 
                              ? new Date(item.createdAt).toLocaleString('ko-KR')
                              : item.createdAt?.toDate ? item.createdAt.toDate().toLocaleString('ko-KR') : ''}
                          </span>
                        )}
                      </div>
                      <p className="text-sm leading-6 text-slate-800 whitespace-pre-wrap font-medium">
                        {item.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
