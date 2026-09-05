import mammoth from 'mammoth';
import { extractText } from 'unpdf';
import { getFirebaseAdmin } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_EXTRACTED_LENGTH = 100_000;

function jsonError(message: string, status: number) {
  return Response.json({ success: false, error: message }, { status });
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization');
  return authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
}

async function extractDocumentText(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const arrayBuffer = await file.arrayBuffer();

  if (extension === 'docx') {
    const result = await mammoth.extractRawText({ buffer: Buffer.from(arrayBuffer) });
    return result.value;
  }
  if (extension === 'pdf') {
    const result = await extractText(new Uint8Array(arrayBuffer), { mergePages: true });
    return result.text;
  }
  throw new Error('PDF 또는 DOCX 파일만 첨부할 수 있습니다.');
}

async function analyzeWithGemini(documentText: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY 환경 변수가 설정되지 않았습니다.');
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: `너는 기존 사업계획서를 PSST 정부지원사업 양식에 맞게 분류하는 분석가다.
원문에 없는 사실이나 수치를 절대 생성하지 말고, 원문 사실과 개선 제안을 명확히 구분하라.
결과는 멘티가 직접 확인하고 수정할 참고자료이므로 짧고 명확한 한국어 Markdown으로 작성하라.` }] },
      contents: [{ role: 'user', parts: [{ text: `아래 사업계획서 원문을 분석해 반드시 다음 제목 구조로 정리하라.

# 첨부자료 분석 결과
## 공통 핵심 사실
- 아이템명, 고객, 현재 진행 상태, 실적, 수치, 출처 등 원문에서 확인되는 사실
## Step 1 참고자료
- 사업 정의, 고객, 문제, 해결 가치
## Step 2 참고자료
- 개발 동기, 고객 불편, 시장 데이터와 근거
## Step 3 참고자료
- 제품 기능, MVP, 구현 기술, 일정, 경쟁력
## Step 4 참고자료
- 수익모델, 가격, 마케팅, 자금계획, 확장 전략
## Step 5 참고자료
- 대표자 및 팀 경력, 역할, 채용 계획
## 유지할 강점
- 기존 문서에서 보존해야 할 강점
## 추가 확인 필요
- 누락, 오래된 수치, 출처 불명, 서로 모순되는 내용

각 사실 뒤에는 가능하면 '(기존 자료)'를 표시하고, 제안은 '(AI 개선 제안)'으로 표시하라.
원문:
${documentText}` }] }],
      generationConfig: { temperature: 0.1, topP: 0.8, maxOutputTokens: 8_192 },
    }),
    cache: 'no-store',
  });
  const data = await response.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
    error?: { message?: string };
  };
  if (!response.ok) throw new Error(data.error?.message || `첨부자료 AI 분석 실패 (${response.status})`);
  const analysis = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim();
  if (!analysis) throw new Error('첨부자료에서 분석 결과를 만들지 못했습니다.');
  return analysis;
}

export async function POST(request: Request) {
  try {
    const token = getBearerToken(request);
    if (!token) return jsonError('로그인이 필요합니다.', 401);
    const { adminAuth } = getFirebaseAdmin();
    await adminAuth.verifyIdToken(token);

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) return jsonError('분석할 파일을 첨부해 주세요.', 400);
    if (file.size > MAX_FILE_SIZE) return jsonError('파일 크기는 10MB 이하여야 합니다.', 413);
    if (!/\.(pdf|docx)$/i.test(file.name)) return jsonError('PDF 또는 DOCX 파일만 첨부할 수 있습니다.', 400);

    const extractedText = (await extractDocumentText(file)).replace(/\u0000/g, '').trim();
    if (extractedText.length < 50) {
      return jsonError('문서에서 읽을 수 있는 글자를 찾지 못했습니다. 스캔 PDF라면 텍스트 인식된 PDF로 변환해 주세요.', 422);
    }
    const truncated = extractedText.length > MAX_EXTRACTED_LENGTH;
    const analysis = await analyzeWithGemini(extractedText.slice(0, MAX_EXTRACTED_LENGTH));

    return Response.json({
      success: true,
      analysis,
      fileName: file.name,
      extractedCharacters: extractedText.length,
      truncated,
    });
  } catch (error) {
    console.error('사업계획서 첨부자료 분석 실패:', error);
    const message = error instanceof Error ? error.message : '첨부자료 분석 중 오류가 발생했습니다.';
    if (message.includes('ID token')) return jsonError('로그인 세션이 만료되었거나 유효하지 않습니다.', 401);
    return jsonError(message, 500);
  }
}
