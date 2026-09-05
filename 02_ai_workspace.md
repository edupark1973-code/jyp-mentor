# Specification: 02_ai_workspace.md (멘티용 AI 사업계획서 7단계 워크스페이스)

이 문서는 염현덕 저자의 **《아이디어를 수익으로 전환하는 AI 사업계획서 프롬프트 공식》** V부 프롬프트 체이닝 이론을 기반으로, 멘티가 자신의 날것 그대로인 아이디어를 고품질 사업계획서 초안으로 고도화할 수 있도록 지원하는 **'AI 7단계 사업계획서 빌더 워크스페이스'** 구현 지시서입니다.

---

## 1. 구현 목표
- 사용자가 복사/붙여넣기를 할 필요 없이, **이전 단계의 생성 결과를 데이터베이스에서 자동으로 조회하여 다음 단계의 프롬프트 컨텍스트(Context)로 누적 전달**하는 '자동 프롬프트 체이닝 엔진' 구축.
- 책에 수록된 핵심 **전문가 페르소나**들을 각 단계에 정밀 배치하여, 일반 챗봇보다 압도적으로 날카롭고 고도화된 비즈니스 논리를 생성.
- 각 단계 사이에 **멘토의 실시간 피드백 검증 현황**을 노출하고, 멘티가 수정 및 개선할 수 있는 단계를 유기적으로 설계.

---

## 2. 7단계 체이닝 워크플로우 및 페르소나 배치 설계

웹서비스의 'AI 사업계획서 빌더'는 아래의 7단계 화면 흐름(Stepper UI)으로 구성됩니다. 각 단계의 AI 백엔드 호출 시, 이전 단계들의 데이터가 누적 주입됩니다.

| 단계 | 과업명 | 배후 작동 전문가 페르소나 및 핵심 프레임워크 | 입력값 (누적 컨텍스트) |
| :--- | :--- | :--- | :--- |
| **Step 1** | **초기 아이디어** | 멘티의 한 줄 요약 및 기초 기획서 입력 | 멘티 최초 입력 아이디어 |
| **Step 2** | **문제 정의** | **페르소나 8 (디자인 리서처)** & **페르소나 10 (린 경영 학자)**<br>- 5Whys 근본원인 분석 및 페르소나 Pain-Point 도출 | Step 1 데이터 |
| **Step 3** | **실현 가능성** | **페르소나 15 (린 스타트업 전문가)** & **페르소나 19 (구독 모델 전문가)**<br>- MVP 가설 정의 및 가치 기반 구독 모델/요금제 설계 | Step 1 ~ 2 데이터 |
| **Step 4** | **성장 전략** | **페르소나 23 (마케팅 총괄)** & **페르소나 20 (경쟁 전략 컨설턴트)**<br>- 틈새시장 정의, VRIO 경쟁 우위 및 Adjacent Market 확장 | Step 1 ~ 3 데이터 |
| **Step 5** | **팀 구성** | **페르소나 24 (수석 헤드헌터)** & **페르소나 25 (혁신 기업 문화 책임자)**<br>- 경력-아이템 연결성 극대화 및 고성과 프로 스포츠팀 조직문화 설계 | Step 1 ~ 4 데이터 |
| **Step 6** | **최종 사업계획서** | 수석 사업계획서 편집자가 Step 1~5 확정본과 멘토 코멘트를 통합하여 제출용 최종안 작성 | Step 1 ~ 5 데이터 + 멘토 코멘트 |
| **Step 7** | **심사위원 검증** | **페르소나 29 (정부 창업 지원 사업 심사위원단 5인)**<br>- 수익성, 기술성, 조직·인력, 마케팅·GTM, 확장성 분야의 익명 가상 심사위원이 최종안에 대한 참고용 모의 심사 보고서 발간 | 멘티가 수정·확정한 Step 6 최종안 |

---

## 3. 백엔드 체이닝 로직 가이드 (Node.js API 예시)

사용자가 특정 단계에서 `[AI 생성하기]` 버튼을 누르면 다음 API 엔드포인트(`src/app/api/generate-step/route.ts`)가 호출됩니다.

```typescript
import { db } from '@/lib/firebaseAdmin';
import { GoogleGenAI } from '@google/genai'; // 또는 OpenAI, Anthropic 등 프로젝트 스택에 준함

export async function POST(req: Request) {
  try {
    const { projectId, currentStep } = await req.json();

    // 1. Firestore에서 해당 프로젝트의 모든 이전 단계 데이터 조회
    const projectDoc = await db.collection('projects').doc(projectId).get();
    const projectData = projectDoc.data();
    
    const stepResultsSnapshot = await db.collection('projects')
      .doc(projectId)
      .collection('step_results')
      .orderBy('step_number', 'asc')
      .get();

    // 2. 이전 단계들의 결과물을 컨텍스트로 누적
    let accumulatedContext = `[초기 비즈니스 아이디어]: ${projectData?.initialIdea}\n\n`;
    stepResultsSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.step_number < currentStep) {
        accumulatedContext += `[Step ${data.step_number} 생성 결과]\n${data.ai_output}\n\n`;
      }
    });

    // 3. 현재 단계에 지정된 페르소나의 역할 및 프롬프트 룰 설계
    const { systemPrompt, userDirective } = getStepPromptConfig(currentStep, accumulatedContext);

    // 4. LLM API 호출
    const aiOutput = await callLLM(systemPrompt, userDirective);

    // 5. 결과를 Firestore step_results 하위 컬렉션에 저장하여 체인 형성
    await db.collection('projects')
      .doc(projectId)
      .collection('step_results')
      .doc(`step_${currentStep}`)
      .set({
        step_number: currentStep,
        ai_output: aiOutput,
        updatedAt: new Date(),
      }, { merge: true });

    return Response.json({ success: true, aiOutput });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
```

---

## 4. 단계별 프롬프트 주입 공식

### 💡 Step 2: 문제 정의 프롬프트 (Persona 8 & 10 조합)
- **System Prompt**:
  ```text
  너는 최고의 디자인 혁신 Firm의 수석 디자인 리서처(페르소나 8)이자 린 경영학자(페르소나 10)야.
  주장에는 반드시 사실적인 데이터 근거를 제시해야 하며, 뜬구름 잡는 소리는 지양한다.
  반드시 정중하고 신뢰감 있는 '하십시오체'를 사용하며, 고객의 Pain Point를 절실하고 생생한 스토리텔링 방식으로 묘사해줘.
  ```
- **User Prompt**:
  ```text
  [이전 컨텍스트]
  ${accumulatedContext}
  
  [과업]
  우리의 초기 아이디어를 바탕으로 고객들이 겪는 표면적 불편함 3가지를 선별하고, 각 불편함에 대해 '5 Whys 기법'을 적용하여 근본 원인(Root Cause)을 도출해줘.
  단순 나열을 넘어, 시니어 식생활 문제와 같이 타겟이 느끼는 실제 고통과 주위 사람(가족 등)이 느끼는 불안감을 심층적으로 대입해줘.
  ```

### 💡 Step 3: 실현 가능성 및 솔루션 프롬프트 (Persona 15 & 19 조합)
- **System Prompt**:
  ```text
  너는 에릭 리스의 '린 스타트업' 방법론에 정통한 최고의 컨설턴트(페르소나 15)이자 가치 기반 가격 정책 전문가(페르소나 19)야.
  객관적이고 명료한 어조인 '해라체'를 사용해 보고서를 조리 있게 작성해라.
  ```
- **User Prompt**:
  ```text
  [이전 컨텍스트]
  ${accumulatedContext}
  
  [과업]
  이전 단계에서 분석된 근본 원인들을 완벽하게 파괴할 수 있는 '최소기능제품(MVP)의 기능 목록'을 정의해줘.
  그리고 이 솔루션을 활용한 최적의 구독 요금제(무료, 기본, 프로 등 등급별 포함 기능 명시)와 가격 책정의 논리를 가치 기반 관점에서 수립해줘.
  ```

### 💡 Step 4: 성장 전략 및 경쟁 분석 프롬프트 (Persona 23 & 20 조합)
- **System Prompt**:
  ```text
  너는 미개척 틈새를 찾아 브랜드 포지셔닝을 하는 마케팅 전략 총괄(페르소나 23)이자, 전통 프레임워크인 VRIO 분석 전문가(페르소나 20)야.
  전략적이고 냉철한 어조인 '해라체'를 사용하여 작성해라.
  ```
- **User Prompt**:
  ```text
  [이전 컨텍스트]
  ${accumulatedContext}
  
  [과업]
  목표 시장 내에서 경쟁사들이 절대 따라올 수 없는 우리만의 '경제적 해자(VRIO)'를 명확히 정의하고, 초기 틈새시장을 타겟으로 한 20자 이내의 강력한 가치제안 슬로건을 뽑아줘.
  그리고 초기 안착 이후 인접 시장(Adjacent Market)으로 확장하기 위한 3단계 성장 로드맵을 작성해줘.
  ```

### 💡 Step 5: 팀 구성 및 조직 철학 프롬프트 (Persona 24 & 25 조합)
- **System Prompt**:
  ```text
  너는 최고의 수석 헤드헌터(페르소나 24)이자 회사를 '프로 스포츠팀'으로 정의하는 혁신 기업의 최고문화책임자(페르소나 25)야.
  ```
- **User Prompt**:
  ```text
  [이전 컨텍스트]
  ${accumulatedContext}
  
  [과업]
  대표자와 핵심 창업 멤버들이 이 비즈니스 아이템을 성공시킬 수밖에 없는 최적의 전문성과 성공 경험(Track Record)을 가졌음을 증명하는 드림팀 경력 소개서(개조식 표 포함)를 수립해줘.
  더불어, 우리 팀이 지향할 '자율과 책임' 기반의 성과 중심 조직 문화 기획안을 도출해줘.
  ```

### 💡 Step 6: 최종 사업계획서 작성 프롬프트
- **System Prompt**:
  ```text
  너는 정부지원사업과 투자심사 제출 문서를 완성하는 수석 사업계획서 편집자야.
  Step 1~5의 멘티 확정본과 멘토 코멘트를 통합하되 제공되지 않은 사실이나 수치를 만들지 마.
  ```
- **User Prompt**:
  ```text
  [이전 컨텍스트]
  ${accumulatedContext}
  
  [과업]
  위의 내용을 기반으로 멘티가 편집·확정할 제출용 최종 사업계획서를 작성해줘.
  ```

### 💡 Step 7: 최종안 심사위원 검증 프롬프트 (Persona 29)
- **System Prompt**:
  ```text
  너는 대한민국 정부 창업지원사업 심사위원단장이야. 수익성, 기술성, 조직·인력, 마케팅·GTM, 확장성 분야의 익명 가상 심사위원단을 운영해.
  실제 인물로 오해할 수 있는 이름이나 소속은 만들지 말고, 멘티가 확정한 사업계획서를 변경하지 않는 참고용 검증 보고서만 작성해.
  ```
- **User Prompt**:
  ```text
  [Step 6 최종 사업계획서]
  ${finalBusinessPlan}

  [과업]
  최종안의 강점, 치명적 결함, 확인 질문, 개선 권고, 점수와 제출 전 확인사항을 분야별로 간결하게 작성해줘.
  ```

---

## 5. 프론트엔드 UI/UX 요구사항
- **반응형 Stepper 컴포넌트**: 좌측이나 상단에 Step 1~7의 마법사형 단계 표시.
- **실시간 멘토 피드백 배너**: 멘토가 작성한 코멘트(`mentor_feedbacks/{projectId}`)가 존재할 경우, 화면 상단에 알림 카드 배너를 띄워 멘티가 이를 참고해 즉시 반영할 수 있게 지원.
- **편집 가능한 텍스트 에디터**: Step 1~6의 AI 초안을 멘티가 직접 편집한 뒤 저장할 수 있는 에디터 제공. Step 7 심사위원 검증 결과는 읽기 전용 참고 자료로 제공.

---

## 6. 품질 및 자가 검증 항목
- [ ] 3단계 생성 시, 2단계의 '문제 정의' 텍스트 내용이 API Request Body 또는 Firebase Firestore Context를 통해 LLM 프롬프트에 정확히 주입되는가?
- [ ] 각 단계에서 사용자가 직접 AI 결과물을 수정 편집한 경우, 다음 단계 AI 호출 시 '수정된 텍스트'가 컨텍스트로 우선 전달되는가?
- [ ] Step 6 최종 사업계획서와 Step 7 참고용 심사 보고서를 한글(.hwp)이나 워드(.docx)에 활용 가능한 텍스트 파일로 내보낼 수 있는가?
