import { getFirebaseAdmin, serverTimestamp } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';

interface GenerateStepRequest {
  projectId?: unknown;
  currentStep?: unknown;
  userInput?: unknown;
}

interface StoredStepResult {
  stepNumber: number;
  userInput: string;
  aiOutput: string;
}

interface PromptConfig {
  stepName: string;
  systemPrompt: string;
  task: string;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
  error?: { message?: string };
}

const MAX_USER_INPUT_LENGTH = 12_000;
const MAX_CONTEXT_LENGTH = 180_000;

const STEP_OUTPUT_LIMITS: Record<number, { maxCharacters: number; maxOutputTokens: number }> = {
  1: { maxCharacters: 1_000, maxOutputTokens: 1_200 },
  2: { maxCharacters: 1_400, maxOutputTokens: 1_600 },
  3: { maxCharacters: 1_400, maxOutputTokens: 1_600 },
  4: { maxCharacters: 1_400, maxOutputTokens: 1_600 },
  5: { maxCharacters: 1_100, maxOutputTokens: 1_300 },
  6: { maxCharacters: 3_500, maxOutputTokens: 3_500 },
  7: { maxCharacters: 1_800, maxOutputTokens: 2_000 },
};

function buildOutputRules(currentStep: number) {
  const { maxCharacters } = STEP_OUTPUT_LIMITS[currentStep];
  return `[출력 품질 규칙 - 다른 문체 및 분량 지시보다 우선 적용]
- 한국어 개요체로 작성함. 문장 종결은 '~함', '~필요', '~예정', '~가능' 등으로 통일함
- 서술형 장문과 인사말을 금지함. Markdown 제목, 짧은 글머리표, 필요한 최소 표만 사용함
- 글머리표 하나에는 핵심 주장 하나만 담고 2줄을 넘기지 않음
- 이전 단계 내용을 그대로 반복하지 않고, 이번 단계의 판단에 필요한 결론만 짧게 인용함
- 같은 의미의 배경 설명, 장점, 기대효과를 중복 작성하지 않음
- 사용자 추가 입력이 없으면 내용을 추측해 부풀리지 않음. 알 수 없는 항목은 '추가 확인 필요'로 표시함
- 근거 없는 수치, 경력, 시장 사실을 만들지 않음
- 전체 출력은 공백 포함 약 ${maxCharacters.toLocaleString('ko-KR')}자 이내로 제한함
- 최종 답변만 출력하고 작성 과정이나 규칙 설명은 출력하지 않음`;
}

const STEP_PROMPTS: Record<number, PromptConfig> = {
  1: {
    stepName: '초기 아이디어 구조화',
    systemPrompt: `너는 초기 창업 아이디어를 구체적인 사업 가설로 구조화하는 수석 비즈니스 디자이너다.
사용자가 제공하지 않은 사실이나 통계를 꾸며내지 말고, 불확실한 내용은 반드시 '검증 필요 가설'로 표시하라.
정중하고 명료한 하십시오체로 작성하라.`,
    task: `초기 아이디어와 창업가의 추가 설명을 바탕으로 다음 항목을 갖춘 기초 사업기획서를 작성하십시오.
1. 한 문장 사업 정의
2. 핵심 고객과 사용 상황
3. 해결하려는 문제
4. 제안 솔루션과 핵심 가치
5. 핵심 가설 및 반드시 검증할 질문
6. 다음 단계 문제 정의를 위한 조사 계획`,
  },
  2: {
    stepName: '문제 정의',
    systemPrompt: `너는 최고의 디자인 혁신 Firm의 수석 디자인 리서처(페르소나 8)이자 린 경영학자(페르소나 10)다.
주장에는 반드시 사실적인 데이터 근거를 제시하고, 확인할 수 없는 수치나 출처는 생성하지 말라. 근거가 부족하면 검증이 필요한 가설로 명시하라.
반드시 정중하고 신뢰감 있는 하십시오체를 사용하며, 고객의 Pain Point를 절실하고 생생한 스토리텔링 방식으로 묘사하라.`,
    task: `초기 아이디어를 바탕으로 고객들이 겪는 표면적 불편함 3가지를 선별하고, 각 불편함에 '5 Whys 기법'을 적용하여 근본 원인(Root Cause)을 도출하십시오.
단순 나열을 넘어 타깃이 느끼는 실제 고통과 가족·동료 등 주변 이해관계자가 느끼는 불안까지 심층적으로 분석하십시오.
마지막에는 문제 우선순위, 검증 방법, 문제-고객 적합성 판단 기준을 표로 정리하십시오.`,
  },
  3: {
    stepName: '실현 가능성 및 솔루션',
    systemPrompt: `너는 에릭 리스의 린 스타트업 방법론에 정통한 최고의 컨설턴트(페르소나 15)이자 가치 기반 가격 정책 및 구독 모델 전문가(페르소나 19)다.
객관적이고 명료한 해라체로 보고서를 작성하라. 모든 가정은 측정 가능한 검증 지표와 연결하고 확인되지 않은 사실은 단정하지 말라.`,
    task: `이전 단계에서 분석된 근본 원인을 해결할 최소기능제품(MVP)의 기능 목록을 정의하라.
각 기능을 문제, 고객 가치, 구현 난이도, 검증 지표와 연결하고 Must/Should/Could로 우선순위를 지정하라.
무료·기본·프로 등 구독 요금제별 포함 기능과 가격 책정 논리를 가치 기반 관점에서 수립하고, 핵심 가설을 검증할 실험 계획까지 제시하라.`,
  },
  4: {
    stepName: '성장 전략 및 경쟁 분석',
    systemPrompt: `너는 미개척 틈새를 찾아 브랜드 포지셔닝을 하는 마케팅 전략 총괄(페르소나 23)이자 전통 전략 프레임워크인 VRIO 분석 전문가(페르소나 20)다.
전략적이고 냉철한 해라체를 사용하라. 경쟁 우위를 과장하지 말고 주장마다 검증 근거 또는 검증 계획을 제시하라.`,
    task: `목표 시장에서 경쟁사가 따라오기 어려운 경제적 해자를 VRIO 관점으로 정의하라.
초기 틈새시장을 특정하고 20자 이내의 강력한 가치제안 슬로건을 제시하라.
직접 경쟁사, 간접 대안, 아무것도 하지 않는 선택을 비교한 경쟁 지도를 만들고 초기 안착 이후 인접 시장(Adjacent Market)으로 확장할 3단계 성장 로드맵과 단계별 KPI를 작성하라.`,
  },
  5: {
    stepName: '팀 구성 및 조직 철학',
    systemPrompt: `너는 최고의 수석 헤드헌터(페르소나 24)이자 회사를 프로 스포츠팀으로 정의하는 혁신 기업의 최고문화책임자(페르소나 25)다.
인물의 경력이나 성과를 임의로 만들어내지 말고, 제공되지 않은 정보는 채용 필요 역량 또는 작성 필요 항목으로 표시하라. 실무적인 하십시오체로 작성하라.`,
    task: `대표자와 핵심 창업 멤버의 실제 입력 정보를 사업 성공에 필요한 역량과 연결한 드림팀 경력 소개서를 개조식 표로 작성하십시오.
현재 팀의 역량 공백, 우선 채용 직무, 직무별 90일 성과 기대치를 제시하십시오.
자율과 책임 기반의 고성과 조직문화 원칙, 의사결정 방식, 성과관리와 갈등 해결 운영안을 도출하십시오.`,
  },
  6: {
    stepName: '최종 사업계획서 작성',
    systemPrompt: `너는 정부지원사업과 투자심사 제출 문서를 완성하는 수석 사업계획서 편집자다.
앞선 1~5단계의 창업가 편집본과 실제 멘토 코멘트를 반영하되 제공되지 않은 사실이나 수치를 창작하지 말라.
사실, 추론, 향후 검증 가설을 명확히 구분하고 제출용 문서에 적합한 간결한 개요체로 완성하라.`,
    task: `누적된 1~5단계 확정 결과와 멘토 코멘트를 통합하여 멘티가 최종 수정할 수 있는 제출용 사업계획서를 작성하라.
문제 정의, 솔루션과 MVP, 시장·경쟁 분석, 비즈니스 모델, GTM·성장 로드맵, 팀, 재무·핵심지표, 위험과 대응, 실행 일정 순서로 구성하라.
아직 확인되지 않은 내용은 사실처럼 보완하지 말고 '추가 확인 필요'로 표시하며, 마지막에 증빙자료 준비 목록을 제시하라.`,
  },
  7: {
    stepName: '최종안 심사위원 검증',
    systemPrompt: `너는 대한민국 정부 창업지원사업 심사위원단장(페르소나 29)이다.
심사위원단은 수익성 심사위원, 기술성 심사위원, 조직·인력 심사위원, 마케팅·GTM 심사위원, 확장성 심사위원으로 구성된 익명의 가상 전문가 집단이다.
실제 인물로 오해할 수 있는 이름이나 소속을 임의로 만들지 말고, 결과에는 각 위원을 전문 분야명으로만 표기하라.
이 결과는 멘티의 최종 사업계획서를 변경하는 본문이 아니라 제출 전 참고용 검증 보고서다. 사실과 추론을 구분하고 존재하지 않는 근거를 만들지 말라.`,
    task: `Step 6에서 멘티가 수정·확정한 최종 사업계획서만을 핵심 심사 대상으로 삼아 5인 가상 심사위원의 참고용 검증 보고서를 작성하라.
위원별로 강점, 치명적 결함, 확인 질문, 개선 권고, 100점 만점 점수를 간결하게 제시하라.
마지막에는 탈락 위험 TOP 5, 제출 전 최종 확인사항, 조건부 합격 여부를 제시하되 사업계획서 본문을 다시 작성하지 말라.`,
  },
};

function jsonError(message: string, status: number) {
  return Response.json({ success: false, error: message }, { status });
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization');
  return authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
}

function buildAccumulatedContext(projectTitle: string, initialIdea: string, steps: StoredStepResult[], mentorFeedback?: Record<string, unknown>) {
  const sections = [
    `[프로젝트명]\n${projectTitle || '프로젝트명 미입력'}`,
    `[초기 비즈니스 아이디어]\n${initialIdea || '초기 아이디어 미입력'}`,
  ];
  for (const step of steps) {
    sections.push(`[Step ${step.stepNumber} 확정 결과 - 창업가 편집본 우선]\n${step.aiOutput}`);
  }
  if (mentorFeedback) {
    const mentorComment = String(mentorFeedback.mentorComment ?? '').trim();
    if (mentorComment) sections.push(`[멘토 코멘트]\n${mentorComment}`);
  }
  const context = sections.join('\n\n');
  return context.length > MAX_CONTEXT_LENGTH
    ? `${context.slice(0, 20_000)}\n\n[중간 컨텍스트 생략]\n\n${context.slice(-(MAX_CONTEXT_LENGTH - 20_000))}`
    : context;
}

async function callGemini(currentStep: number, systemPrompt: string, userPrompt: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY 환경 변수가 설정되지 않았습니다.');
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const { maxOutputTokens } = STEP_OUTPUT_LIMITS[currentStep];
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: `${systemPrompt}\n\n${buildOutputRules(currentStep)}` }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: { temperature: 0.3, topP: 0.85, maxOutputTokens },
    }),
    cache: 'no-store',
  });
  const data = await response.json() as GeminiResponse;
  if (!response.ok) throw new Error(data.error?.message || `Gemini API 요청 실패 (${response.status})`);
  const output = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim();
  if (!output) throw new Error(data.promptFeedback?.blockReason ? `AI 응답 차단: ${data.promptFeedback.blockReason}` : 'AI가 빈 응답을 반환했습니다.');
  return { output, model };
}

export async function POST(request: Request) {
  try {
    const token = getBearerToken(request);
    if (!token) return jsonError('로그인이 필요합니다.', 401);

    let body: GenerateStepRequest;
    try {
      body = await request.json() as GenerateStepRequest;
    } catch {
      return jsonError('올바른 JSON 요청 본문이 필요합니다.', 400);
    }

    const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : '';
    const currentStep = typeof body.currentStep === 'number' ? body.currentStep : Number(body.currentStep);
    const userInput = typeof body.userInput === 'string' ? body.userInput.trim() : '';
    if (!projectId || projectId.includes('/')) return jsonError('유효한 projectId가 필요합니다.', 400);
    if (!Number.isInteger(currentStep) || currentStep < 1 || currentStep > 7) return jsonError('currentStep은 1부터 7 사이의 정수여야 합니다.', 400);
    if (userInput.length > MAX_USER_INPUT_LENGTH) return jsonError(`userInput은 ${MAX_USER_INPUT_LENGTH.toLocaleString()}자 이하여야 합니다.`, 400);

    const { adminAuth, adminDb } = getFirebaseAdmin();
    const decodedToken = await adminAuth.verifyIdToken(token);
    const [projectSnapshot, requesterSnapshot] = await Promise.all([
      adminDb.collection('projects').doc(projectId).get(),
      adminDb.collection('users').doc(decodedToken.uid).get(),
    ]);
    if (!projectSnapshot.exists) return jsonError('프로젝트를 찾을 수 없습니다.', 404);

    const projectData = projectSnapshot.data() ?? {};
    const ownerId = String(projectData.menteeId ?? projectData.userId ?? '');
    const isMentor = requesterSnapshot.data()?.role === 'mentor';
    if (ownerId !== decodedToken.uid && !isMentor) return jsonError('이 프로젝트에 접근할 권한이 없습니다.', 403);

    const stepsSnapshot = await adminDb.collection('step_results').where('projectId', '==', projectId).get();
    const previousSteps: StoredStepResult[] = stepsSnapshot.docs
      .map((stepDoc: { data: () => Record<string, unknown> }) => {
        const data = stepDoc.data();
        return {
          stepNumber: Number(data.stepNumber ?? data.step_number ?? 0),
          userInput: String(data.userInput ?? data.user_input ?? ''),
          aiOutput: String(data.aiOutput ?? data.ai_output ?? ''),
        };
      })
      .filter((step: StoredStepResult) => step.stepNumber > 0 && step.stepNumber < currentStep && step.aiOutput)
      .sort((a: StoredStepResult, b: StoredStepResult) => a.stepNumber - b.stepNumber);

    const requiredPreviousSteps = Array.from({ length: Math.max(0, currentStep - 2) }, (_, index) => index + 2);
    const missingStep = requiredPreviousSteps.find((step) => !previousSteps.some((result) => result.stepNumber === step));
    if (missingStep) return jsonError(`Step ${missingStep} 결과를 먼저 생성하거나 저장해 주세요.`, 409);

    let mentorFeedback: Record<string, unknown> | undefined;
    if (currentStep === 6) {
      const feedbackSnapshot = await adminDb.collection('mentor_feedbacks').doc(projectId).get();
      mentorFeedback = feedbackSnapshot.exists ? feedbackSnapshot.data() : undefined;
    }

    const promptConfig = STEP_PROMPTS[currentStep];
    const accumulatedContext = buildAccumulatedContext(
      String(projectData.title ?? ''),
      String(projectData.initialIdea ?? ''),
      previousSteps,
      mentorFeedback,
    );
    const userDirective = `[누적 컨텍스트]\n${accumulatedContext}\n\n[현재 창업가 추가 입력]\n${userInput || '추가 입력 없음. 누적 자료에 없는 내용을 임의로 확장하지 말고, 필요한 정보는 추가 확인 필요로 표시할 것.'}\n\n[이번 단계 과업]\n${promptConfig.task}\n\n이전 단계의 본문을 재작성하지 말고 이번 단계에서 새로 결정할 핵심만 작성할 것.`;
    const { output: aiOutput, model } = await callGemini(currentStep, promptConfig.systemPrompt, userDirective);

    const resultRef = adminDb.collection('step_results').doc(`${projectId}_step_${currentStep}`);
    const batch = adminDb.batch();
    batch.set(resultRef, {
      projectId,
      stepNumber: currentStep,
      userInput,
      aiOutput,
      model,
      workflowVersion: 2,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    batch.set(projectSnapshot.ref, {
      currentStep: Math.max(Number(projectData.currentStep ?? 1), currentStep),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    await batch.commit();

    return Response.json({ success: true, projectId, currentStep, stepName: promptConfig.stepName, aiOutput });
  } catch (error) {
    console.error('AI 단계 생성 실패:', error);
    const message = error instanceof Error ? error.message : 'AI 결과 생성 중 오류가 발생했습니다.';
    if (message.includes('ID token')) return jsonError('로그인 세션이 만료되었거나 유효하지 않습니다.', 401);
    return jsonError(message, 500);
  }
}
