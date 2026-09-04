# 00_architecture.md: JYP-Mentor AI 융합 개편 아키텍처 가이드라인

본 문서는 기존의 `jyp-mentor.web.app` 서비스에 염현덕 저자의 **《아이디어를 수익으로 전환하는 AI 사업계획서 프롬프트 공식》**의 핵심 전략(7단계 프롬프트 체이닝, 5인 심사위원단 가상 검증, 사업/결과 검증 체크리스트, 무료 SMTP 알림 메일)을 녹여내어 '올인원 창업 멘토링 플랫폼'으로 개편하기 위한 백엔드, DB 스키마, 권한 및 라우팅 상세 설계도이다 [17-18].

---

## 1. 시스템 개요 및 권한 구조 (System Overview & Auth)

기존 Firebase Authentication 시스템을 그대로 활용하며, 모든 사용자의 역할(Role)에 따라 접근 권한을 물리적으로 제어한다.

### 👥 사용자 역할 정의
*   **창업가(Mentee)**: 일반 사용자로서 로그인 후 자신의 아이템에 대해 7단계 워크스페이스를 통해 사업계획서 초안을 작성하고 피드백을 확인한다 [17-18].
*   **최고관리자(Mentor)**: 멘토 계정으로, 로그인 시 `/admin/dashboard`로 강제 리다이렉트된다. 데이터베이스 상의 모든 멘티 프로젝트에 무제한 접근(조회, 수정, 삭제) 권한을 가지며 검증 체크리스트 및 멘토 코멘트를 저장할 수 있다 [59-62, 65].

---

## 2. 데이터베이스 스키마 설계 (Firestore DB Schema)

Firestore는 문서 지향 NoSQL DB로, 아래와 같이 4개의 핵심 컬렉션으로 설계한다.

### ① `users` Collection
개별 사용자의 프로필 및 권한 상태를 제어한다.
```typescript
interface UserDocument {
  uid: string;             // Firebase Auth UID (Primary Key)
  email: string;           // 사용자 이메일 주소
  displayName?: string;    // 사용자 이름
  role: 'mentor' | 'mentee'; // 최고관리자(멘토) 여부 판별 필드
  createdAt: timestamp;    // 가입일자
}
```

### ② `projects` Collection
멘티가 등록한 사업계획서 아이템의 마스터 테이블이다.
```typescript
interface ProjectDocument {
  id: string;              // 프로젝트 고유 ID (Primary Key)
  menteeId: string;        // 작성한 멘티의 users.uid (Foreign Key)
  title: string;           // 사업계획서 제목 (아이템 이름)
  initialIdea: string;     // 최초 입력한 한 줄 아이디어 [17-18]
  currentStep: number;     // 현재 진행 중인 스텝 (1 ~ 7단계) [17-18]
  createdAt: timestamp;    // 생성 시간
  updatedAt: timestamp;    // 최종 수정 시간
}
```

### ③ `step_results` Collection
7단계 프롬프트 체이닝 과정에서 생성되는 각 단계별 AI 출력물과 사용자 입력값의 누적 기록 저장소이다 [17-18].
```typescript
interface StepResultDocument {
  id: string;              // 고유 ID (Primary Key)
  projectId: string;       // projects.id (Foreign Key)
  stepNumber: number;      // 7단계 중 해당 단계의 번호 (1 ~ 7) [17-18]
  userInput: string;       // 사용자가 해당 단계에서 추가적으로 지시하거나 입력한 내용 [17-18]
  aiOutput: string;        // 해당 단계의 페르소나 및 체이닝 로직에 의해 생성된 결과물 본문
  updatedAt: timestamp;    // 생성 및 수정 일시
}
```

### ④ `mentor_feedbacks` Collection
멘토가 멘티의 프로젝트를 평가하고 승인하기 위한 검증 데이터 테이블이다 [59-62, 65].
```typescript
interface MentorFeedbackDocument {
  id: string;              // 고유 ID (Primary Key)
  projectId: string;       // projects.id (Foreign Key)
  stepNumber: number;      // 피드백을 남기는 단계 번호 (1 ~ 7)
  mentorComment: string;   // 멘토가 입력한 텍스트 피드백 코멘트
  
  // 1. 사업 검증/개선용 Checklist (p.207 수록 핵심지표 데이터 구조) [59-62]
  businessChecklist: {
    valueProved: boolean;        // 1) 절실한 문제(Pain-Point)와 해결책이 명확하게 연결되는가? [59]
    uniqueAdvantage: boolean;    // 2) 기존 대안 대비 독보적인 차별적 가치를 설명했는가? [59]
    quantifiedValue: boolean;    // 3) 가치를 구체적인 숫자(비용절감, 시간단축 등)로 정량화했는가? [59]
    dataBacked: boolean;         // 4) 초기 고객 목소리나 사용 데이터로 가치를 증명했는가? [59]
    marketTiming: boolean;       // 5) 왜 지금(Why Now) 시작해야 하는가에 대한 타당성이 있는가? [59]
    marketSize: boolean;         // 6) 시장 규모(TAM-SAM-SOM)를 교차 검증하여 제시했는가? [59]
    profitability: boolean;      // 7) 높은 수익성을 낼 수 있는가에 대한 객관적 근거가 있는가? [59]
    beachheadMarket: boolean;    // 8) 가장 먼저 진입할 교두보 시장이 정의되었는가? [60]
    alternativesMapped: boolean; // 9) 고객의 모든 우회 대안(아무것도 하지 않음 포함)을 경쟁자로 식별했는가? [60]
    vrioMoat: boolean;           // 10) 핵심역량이 VRIO 기반 경제적 해자임을 입증했는가? [60]
    strategicTradeoff: boolean;  // 11) 무엇을 포기하고 어디에 집중할지 명확한 포지션 선택이 있는가? [60]
    ltvGreaterThanCac: boolean;  // 12) LTV > CAC 공식을 충족하는 구체적 추정이 있는가? [60]
    pricingModel: boolean;       // 13) 고객 지불 의향과 심리를 고려한 가치 기반 가격설정인가? [60]
    multiRevenueStreams: boolean;// 14) 장기 수익 다각화를 위한 다중 수익 모델 로드맵이 있는가? [60-61]
    acquisitionFunnel: boolean;  // 15) 고객 획득 경로(Funnel) 및 구체적 플랜이 있는가? [61]
    clearKpis: boolean;          // 16) 목표가 성과 지표(OKR/KPI) 및 구체적인 마일스톤과 연결되어 있는가? [61]
    riskManagement: boolean;     // 17) 통제 불가한 외부 리스크(법규, 규제)의 비상 계획이 있는가? [61]
  };

  // 2. 결과 검증 Checklist (p.209 수록 환각/오류 방지 장치) [65]
  resultChecklist: {
    noHallucination: boolean;    // 1) 출처 없는 통계나 발언 등 환각 현상이 없는가? [65]
    sourceReliability: boolean;  // 2) 인용된 데이터가 1차 자료(정부 통계 등)이며 왜곡이 없는가? [65]
    hiddenAssumptionChecked: boolean; // 3) 주장에 깔린 '숨겨진 가정'들이 합리적인가? [65]
    noLogicalFallacy: boolean;   // 4) 상관관계를 인과관계로 착각하거나 생존 편향 등의 오류가 없는가? [65]
    factOpinionDistinction: boolean; // 5) 사실, 추론, 가능성을 명확하게 구분하여 서술했는가? [65]
  };

  updatedAt: timestamp;    // 피드백 최종 등록 및 전송 시간
}
```

---

## 3. 웹 서비스 라우팅 및 뷰 구성 (Routes & Views Map)

기존 프로젝트의 UI/UX와 완벽히 격리된 신규 페이지 구조를 가져간다.

```text
/ (홈페이지 / 기존 멘토링 예약 및 강의자료실)
 └── /ai
      ├── /workspace             [Mentee 전용] 7단계 사업계획서 작성 워크스페이스 [17-18]
      └── /dashboard             [Mentee 전용] 자신이 생성한 프로젝트 전체 리스트 관리
 └── /admin
      ├── /dashboard             [Mentor 최고관리자] 모든 멘티의 프로젝트 현황판 및 이메일 일괄 공지 폼
      └── /projects/[id]         [Mentor 최고관리자] 특정 멘티의 계획서 7단계 내용 모니터링, 체크리스트 작성, 피드백 등록 창
```

---

## 4. 백엔드 AI 엔진 및 메일 알림 프로세스 (AI Chain & SMTP Notification)

### 🤖 7단계 프롬프트 체이닝 엔진 백엔드 작동 매커니즘 [17-18]
사용자가 복사/붙여넣기를 할 필요 없도록 백엔드 API에서 이전 `step_results` 데이터를 Firestore에서 조회해 시스템 메시지로 자동 이입(Injection)한다 [17-18].

```text
[Step 1: 초기 아이디어 입력]
       ↓ (데이터베이스 저장)
[Step 2: 문제 정의] (Persona 8 수석 디자인 리서처 소환) -> (Step 1 아이디어 주입) [41, 17-18]
       ↓ (결과 누적)
[Step 3: 솔루션 설계] (Persona 15 린 스타트업 전문가 소환) -> (Step 1+2 결과 자동 이입) [48, 17-18]
       ↓ (결과 누적)
[Step 4: 성장 전략] (Persona 19 구독 모델 전문가 & Persona 20 경쟁전략 컨설턴트 소환) -> (Step 1+2+3 결과 자동 이입) [52, 53, 17-18]
       ↓ (결과 누적)
[Step 5: 팀 구성] (Persona 24 전문 헤드헌터 소환) -> (Step 1~4 결과 자동 이입) [27, 17-18]
       ↓ (결과 누적)
[Step 6: 5인 심사위원단 검증] (Persona 29 가상 심사위원단 5인 소환 및 종합 보고서 발행) [55-58, 17-18]
       ↓ (결과 누적)
[Step 7: 최종 수정 및 제출] (종합 수정본 자동 생성) [17-18]
```

### ✉️ 무료 이메일 SMTP 연동 규칙
*   **사용 모듈**: Node.js `nodemailer` 또는 Python `smtplib` 활용.
*   **인증 방식**: 구글 개인 계정 설정에서 '앱 비밀번호(App Password)'를 발급받아 프로젝트 `.env` 파일에 암호화하여 저장.
*   **알림 트리거**:
    1.  멘토가 특정 프로젝트에서 피드백 등록/체크리스트 저장을 완료하는 순간, 메일 발송 유틸이 비동기적으로 호출되어 멘티에게 피드백 요약 메일을 발송한다.
    2.  멘토 대시보드에서 `[공지 메일 발송]` 트리거 시 `users` 컬렉션의 모든 `role === 'mentee'` 유저 이메일로 대량(Bcc) 메일을 자동 일괄 전송한다.

---

## 5. 파이어베이스 보안 규칙 설계 (Firestore Security Rules)

어드민(최고관리자 멘토) 권한이 타인의 프로젝트 정보 및 피드백 데이터를 조회할 수 있도록 보안 규칙을 강제한다.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // 사용자가 로그인되어 있고, 멘토 역할인지 판단하는 헬퍼 함수
    function isMentor() {
      return request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'mentor';
    }

    // users 컬렉션 권한 규칙
    match /users/{userId} {
      allow read, write: if request.auth != null && (request.auth.uid == userId || isMentor());
    }

    // projects 컬렉션 권한 규칙
    match /projects/{projectId} {
      allow read, write: if request.auth != null && (resource.data.menteeId == request.auth.uid || isMentor());
      allow create: if request.auth != null; // 로그인 사용자 프로젝트 생성 가능
    }

    // step_results 컬렉션 권한 규칙
    match /step_results/{resultId} {
      allow read, write: if request.auth != null && 
        (get(/databases/$(database)/documents/projects/$(resource.data.projectId)).data.menteeId == request.auth.uid || isMentor());
      allow create: if request.auth != null;
    }

    // mentor_feedbacks 컬렉션 권한 규칙
    match /mentor_feedbacks/{feedbackId} {
      allow read: if request.auth != null && 
        (get(/databases/$(database)/documents/projects/$(resource.data.projectId)).data.menteeId == request.auth.uid || isMentor());
      allow write: if isMentor(); // 오직 멘토 최고관리자만 피드백 쓰기 가능
    }
  }
}
```

---

## 6. 개발 시작을 위한 첫 명령어 가이드

본 마인드맵 및 아키텍처 문서를 로컬 디렉토리 최상위에 `00_architecture.md`로 안착시킨 후, VS Code CLI 및 AI 코딩 어시스턴트(Cursor, Copilot 등)에 던질 첫 작업 가이드는 아래와 같다.

```bash
# 1. 기존 프로젝트 작업 영역으로 이동
cd path/to/jyp-mentor-app

# 2. 개편 작업을 위한 안전한 개발 브랜치 생성
git checkout -b feature/ai-integration-architecture
```

위 브랜치 상에서 `00_architecture.md`에 맞춰 개발을 진행한 뒤, 검증이 끝나면 메인 브랜치와 병합(Merge)하여 배포(firebase deploy)하면 무결한 개편이 보장된다.
