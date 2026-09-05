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
  1: { maxCharacters: 1_000, maxOutputTokens: 8_192 },
  2: { maxCharacters: 1_400, maxOutputTokens: 8_192 },
  3: { maxCharacters: 1_400, maxOutputTokens: 8_192 },
  4: { maxCharacters: 1_400, maxOutputTokens: 8_192 },
  5: { maxCharacters: 1_100, maxOutputTokens: 8_192 },
  6: { maxCharacters: 3_500, maxOutputTokens: 12_000 },
  7: { maxCharacters: 1_800, maxOutputTokens: 8_192 },
};

function buildOutputRules(currentStep: number) {
  const { maxCharacters } = STEP_OUTPUT_LIMITS[currentStep];
  return `[출력 품질 규칙 - 다른 문체 및 분량 지시보다 우선 적용]
- 한국어 개요체로 작성함. 문장 종결은 '~함', '~필요', '~예정', '~가능' 등으로 통일함
- 불필요한 영어 단어나 어려운 전문 용어(예: 경제적 해자, Pain Point 등) 사용을 최대한 자제하고, 누구나 이해하기 쉬운 자연스러운 우리말로 풀어서 작성함
- 서술형 장문과 인사말을 금지함. Markdown 제목, 짧은 글머리표, 필요한 최소 표만 사용함
- 글머리표 하나에는 핵심 주장 하나만 담고 3줄을 넘기지 않음
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
정중하고 명료한 개요체로 작성하라.`,
    task: `초기 아이디어와 창업가의 추가 설명을 바탕으로 다음 항목을 갖춘 기초 사업기획서를 작성하십시오.
1. 한 문장 사업 정의
2. 핵심 고객과 사용 상황
3. 해결하려는 문제
4. 제안 솔루션과 핵심 가치
5. 핵심 가설 및 반드시 검증할 질문
6. 다음 단계 문제 정의를 위한 조사 계획`,
  },
  2: {
    stepName: '1. 문제인식 (Problem)',
    systemPrompt: `너는 최고의 디자인 혁신 Firm의 수석 디자인 리서처(페르소나 8)이자 린 경영학자(페르소나 10)다.
정부지원사업 심사위원이 한눈에 타당성을 납득할 수 있도록, 공공기관 보고서 스타일의 객관적이고 신뢰감 있는 개요체(개조식, ~함, ~임 등)를 사용하라. 
주장에는 반드시 사실적인 시장 데이터, 통계, 뉴스 등 객관적 근거를 제시하고 확인할 수 없는 수치는 가상의 플레이스홀더[데이터 입력]로 비워두라.`,
    task: `본 창업아이템의 개발 동기 및 필요성(문제인식)을 아래 구조에 맞추어 구체적으로 작성하라.

1. [1-1. 개발동기 - 고객의 페인포인트와 근본 원인]:
   - 타깃 고객이 겪는 표면적 불편함 3가지를 선별하고, 각 불편함의 근본 원인(Root Cause)을 도출하라.
   - 단순 나열을 넘어 타깃이 느끼는 실제 고통과 주변 이해관계자(가족, 동료 등)가 느끼는 심층적 불안·불편을 생생한 맥락과 함께 기술하라.

2. [1-2. 개발목적 - 필요성 및 시장 데이터]:
   - 이 문제를 지금 왜 해결해야 하는지 시급성과 필요성을 설명하라.
   - 주장을 뒷받침할 수 있는 거시적 시장 변화(트렌드), 규제, 또는 통계적 데이터 근거를 연결하여 작성하라.

3. [문제 검증 프레임워크]:
   - 마지막에는 도출한 문제들의 우선순위, 가설 검증 방법(인터뷰, 설문 등), 문제-고객 적합성(Problem-Solution Fit) 판단 기준을 명확한 표(Table)로 정리하라.`,
  },

  3: {
    stepName: '실현 가능성 및 솔루션',
   systemPrompt: `너는 에릭 리스의 린 스타트업 방법론에 정통한 최고의 스타트업 컨설턴트이자, 정부지원사업(예창패/초창패) 사업계획서 작성 및 평가 전문가다.
국공직 보고서 형태의 객관적이고 명료한 개요식 문체(‘~함’, ‘~구축’ 등)로 작성하라. 모든 개발 계획은 실현 가능성을 중심으로 서술하고, 추상적인 표현은 배제하라.`,
    task: `이전 단계에서 분석된 문제를 해결할 창업아이템의 핵심 기능과 서비스 구현 방안을 정의하라.
1) 핵심 기능 및 MVP 정의: 제품/서비스의 주요 기능과 MVP(최소기능제품)의 핵심 스펙을 정의하고, 이것이 고객 문제와 어떻게 연결되는지 서술하라.
2) 구체적인 개발(제작) 방안: 자체 개발 및 외주 활용 여부, 필요 기술 Stack, 최종 산출물의 형태를 명확히 제시하라.
3) 개발 추진 일정: 제품 개발부터 출시까지의 마일스톤을 3~4단계의 구체적인 일정(예: O개월 차~O개월 차)과 단계별 결과물로 나누어 작성하라.
4) 경쟁력 및 차별성: 시장 내 기존 제품/서비스(직접 경쟁사 및 간접 대안) 대비 우리 아이템만의 독점적 차별성 및 우위를 비교 제시하라.`
  },
  4: {
    stepName: '성장 전략 및 경쟁 분석',
     systemPrompt: `너는 가치 기반 가격 정책 및 BM 고도화 전문가이자, 초기 시장 안착을 이끄는 마케팅 전략 총괄(CMO)이다.
전략적이고 냉철한 개요체(명사형 종결)를 사용하라. 매출 및 성장 지표는 실현 가능한 범위 내에서 논리적 근거(Raw Data 및 산식)와 함께 제시하라.`,
    task: `목표 시장 진입 및 스케일업을 위한 비즈니스 모델 고도화, 자금 계획, 마케팅 전략을 수립하라.
1) 비즈니스 모델(수익구조) 고도화: 무료·기본·프로 등 구독 요금제별 포함 기능과 가격 책정 논리를 가치 기반 관점에서 수립하고, 서비스 제공자와 이용자 간의 수익 흐름을 명확히 정의하라.
2) 자금 조달 및 집행 계획: 정부지원금(총 사업비)의 효율적인 집행 예산 편성(외주용역비, 마케팅비, 인건비 등) 기준을 제시하고, 향후 매출 및 추가 투자 유치를 통한 자금 조달 로드맵을 작성하라.
3) 시장 진입 및 마케팅 전략: 초기 핵심 타겟 고객층(틈새시장) 선점 전략을 20자 이내의 강력한 가치제안 슬로건과 함께 제시하고, 온/오프라인 고객 획득(CAC) 채널을 구체화하라.
4) 인접 시장 확장 로드맵: 초기 시장 안착 이후 인접 시장으로 확장할 3단계 성장 로드맵과 단계별 핵심 성과 지표(KPI)를 제시하라.`
  },
  5: {
    stepName: '팀 구성 및 조직 철학',
    systemPrompt: `너는 최고의 수석 헤드헌터(페르소나 24)이자 회사를 프로 스포츠팀으로 정의하는 혁신 기업의 최고문화책임자(페르소나 25)다.
인물의 경력이나 성과를 임의로 만들어내지 말고, 제공되지 않은 정보는 채용 필요 역량 또는 작성 필요 항목으로 표시하라. 실무적인 개요체로 작성하라.`,
    task: `대표자와 핵심 창업 멤버의 실제 입력 정보를 사업 성공에 필요한 역량과 연결한 드림팀 경력 소개서를 개조식 표로 작성하십시오.
현재 팀의 역량 공백, 우선 채용 직무, 직무별 성과 기대치를 제시하십시오.`,
  },
  
  6: {
    stepName: '최종 사업계획서 통합 및 편집',
    systemPrompt: `너는 정부지원사업(예창패·초창패) 공공 서식 및 합격 사업계획서 작성을 전문으로 하는 수석 편집자다.
앞선 단계들의 확정 결과와 멘토 코멘트를 완벽히 반영하되, 제공되지 않은 사실이나 수치를 임의로 창작(환각)하지 말라.
철저하게 정부 심사위원 제출용 표준 가이드라인에 맞추어 군더더기 없는 개조식 보고서 문체(~함, ~임, ~구축)로 작성하라.`,
    task: `누적된 1~5단계의 결과물과 멘토 피드백을 통합하여, 주관기관 제출 전 창업자가 최종 검토·보완할 수 있는 'PSST 표준 사업계획서 초안'을 아래 공식 목차 순서에 맞추어 완성하라.

[공식 제출용 목차 구조]:
1. 일반현황 (창업아이템명, 요약문 요약 기술)
2. 1. 문제인식 (Problem)
   - 1-1. 창업아이템의 개발동기 (고객 페인포인트 및 근본원인)
   - 1-2. 창업아이템의 목적(필요성) (시장 데이터 및 시급성)
3. 2. 해결방안 (Solution)
   - 2-1. 창업아이템의 개발·구현 방안 (MVP 핵심 기능, 구현 계획 및 가설 검증 실험)
   - 2-2. 창업아이템의 경쟁력 확보방안 (차별성, 기술 우위, 특허/IP 자산 확보 계획 등)
4. 3. 성장전략 (Scale-up)
   - 3-1. 자금조달 및 비즈니스 모델(수익구조) 고도화 방안 (가치 기반 요금제, 수익 흐름, 정부지원금 집행 계획)
   - 3-2. 내수시장 확보 및 글로벌 진출 전략 (초기 틈새시장 포지셔닝, 20자 슬로건, 경쟁 지도 및 3단계 확장 로드맵/KPI)
5. 4. 팀 구성 (Team)
   - 4-1. 대표자 및 현황(역량) (R&R 및 드림팀 경력 요약)
   - 4-2. 팀원 현황 및 추가 채용계획 (역량 공백 보완, 신규 채용 및 외부 자문단 활용 계획)

[작성 지침]:
- 데이터나 근거가 부족하여 아직 확인되지 않은 항목은 절대 그럴듯하게 꾸며내지 말고, 대괄호와 함께 '[⚠️ 추가 확인 및 데이터 보완 필요]'라고 명확히 표시하여 창업자가 직접 채울 수 있게 하라.
- 문서 맨 마지막에는 본 사업계획서의 신뢰도를 높이기 위해 창업자가 메인 본문 뒤에 첨부해야 할 '증빙자료 준비 목록(예: 특허 출원서, 설문조사 결과 그래프, MVP 프로토타입 캡처 화면, MOU 체결서 등)'을 리스트업하여 제시하라.`,
  },

  7: {
    stepName: '7. 최종안 심사위원 사전 검증',
    systemPrompt: `너는 대한민국 정부 창업지원사업(예창패·초창패)의 가상 심사위원단장(페르소나 29)이다.
너의 심사위원단은 정부 지원사업 평가 지표에 특화된 5인의 가상 전문가로 구성된다:
- 위원 A (문제인식/시장성 심사위원)
- 위원 B (해결방안/기술성 심사위원)
- 위원 C (성장전략/수익성 심사위원)
- 위원 D (마케팅/시장 진입 심사위원)
- 위원 E (팀 구성/인력 역량 심사위원)
실제 인물로 오해할 수 있는 이름이나 소속을 임의로 창작(환각)하지 말라. 이 검증 보고서는 사업계획서 본문을 수정하는 것이 아니라, 제출 전 참고용 평가 서류다. 사실과 추론을 명확히 구분하라.`,
    task: `Step 6에서 창업자가 완성한 최종 사업계획서만을 대상으로 공식 평가 기준에 따른 가상 검증 보고서를 작성하라.

1. [5인 위원별 개별 평가]:
   각 위원(A~E)의 전문 분야 관점에서 아래 항목을 아주 냉정하고 간결하게 서술하라.
   - 강점 (합격 요인)
   - 치명적 결함 및 감점 요인 (미흡한 부분)
   - 대면 평가 시 예상 질문 (확인 질문)
   - 서류 제출 전 최종 개선 권고
   - 위원별 평가 점수 (100점 만점 기준)

2. [종합 심사 결과 요약]:
   - 가상 심사위원 5인의 '평균 점수'를 산출하여 제시하라.
   - [탈락 위험 TOP 3]: 감점이 크게 발생할 수 있는 가장 위험한 요소 3가지를 꼽아라.
   - [제출 전 필수 체크리스트]: 오탈자, 필수 서류 누락 여부 등 마감 직전 확인해야 할 사항을 제시하라.
   - [조건부 합격 판정]: 현재 상태로 제출 시 서류 합격 가능성(안정/경합/과락)을 냉정하게 판정하라. (단, 사업계획서 본문을 다시 작성하지 말 것)`,
  },
};


function jsonError(message: string, status: number) {
  return Response.json({ success: false, error: message }, { status });
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization');
  return authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
}

function getSourceDocumentContext(analysis: string, currentStep: number) {
  if (!analysis || currentStep === 7) return '';
  if (currentStep === 6) return analysis;
  const section = (title: string) => analysis.match(new RegExp(`## ${title}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`))?.[1]?.trim() ?? '';
  const selected = [section('공통 핵심 사실'), section(`Step ${currentStep} 참고자료`)].filter(Boolean).join('\n\n');
  return selected || analysis.slice(0, 20_000);
}

function buildAccumulatedContext(projectTitle: string, initialIdea: string, sourceDocumentAnalysis: string, currentStep: number, steps: StoredStepResult[], mentorFeedback?: Record<string, unknown>) {
  const sections = [
    `[프로젝트명]\n${projectTitle || '프로젝트명 미입력'}`,
    `[초기 비즈니스 아이디어]\n${initialIdea || '초기 아이디어 미입력'}`,
  ];
  const sourceContext = getSourceDocumentContext(sourceDocumentAnalysis, currentStep);
  if (sourceContext) {
    sections.push(`[멘티가 확인한 기존 사업계획서 참고자료 - 원문 사실 우선, AI 제안은 제안으로만 취급]\n${sourceContext}`);
  }
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
  const candidate = data.candidates?.[0];
  if (candidate?.finishReason === 'MAX_TOKENS') {
    throw new Error('AI 응답이 작성 도중 중단되었습니다. 다시 시도해 주세요.');
  }
  if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
    throw new Error(`AI 응답이 정상적으로 완료되지 않았습니다. (${candidate.finishReason})`);
  }
  const output = candidate?.content?.parts?.map((part) => part.text ?? '').join('').trim();
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
      String(projectData.sourceDocumentAnalysis ?? ''),
      currentStep,
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
