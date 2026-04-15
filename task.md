
# 📋 TASK.md: EduFiles MVP 개발 태스크 리스트

## 📌 [상단] Phase별 체크리스트

> 작업 완료 시 `[x]`로 표시하여 진척도를 관리합니다.

### Phase 1: 환경 설정 및 인증 (Setup & Auth)

  - [x] 1.1 Next.js 프로젝트 생성 및 정적 배포(`output: 'export'`) 설정
  - [x] 1.2 Firebase 프로젝트 연동 (Hosting, Auth, Firestore, Storage) 초기화
  - [x] 1.3 Google 소셜 로그인 기능 구현 (Firebase Auth)
  - [x] 1.4 유저 역할(Admin/User) 필터링 및 전역 상태(Context/Zustand) 연동

### Phase 2: 강의 및 자료 관리 (Lecture Hub)

  - [x] 2.1 [Admin] 강의 생성/수정 UI 및 Firestore 연동
  - [x] 2.2 [Admin] 자료 업로드(Storage) 및 강의-자료 관계 매핑 로직 구현
  - [x] 2.3 [Guest/User] 쿼리 파라미터(`?id=`) 기반 강의 상세 페이지 구현
  - [x] 2.4 [Admin] 발표용 라이브 모드 UI(`?id=...&mode=live`) 구현

### Phase 3: 비동기 Q\&A 게시판 (Q\&A Board)

  - [x] 3.1 질문 등록 및 댓글 UI 개발
  - [x] 3.2 `onSnapshot` 기반 실시간 질문 목록 업데이트 (클라이언트 사이드)
  - [x] 3.3 [Admin] 주요 질문 상단 고정(Pin) 기능 구현

### Phase 4: 멘토링 예약 및 피드백 (Mentoring)

  - [x] 4.1 [Admin] 가용 시간 슬롯(Slot) 생성 및 관리 UI 개발
  - [x] 4.2 [User] 슬롯 선택 및 사업계획서 업로드(Storage) → 예약 생성(Firestore) 순차 로직 구현
  - [x] 4.3 [Admin] 예약 상세 확인 및 피드백(텍스트/파일) 작성 기능 개발
  - [x] 4.4 개인정보 보호를 위한 Firestore Security Rules 적용

### Phase 5: 최종 배포 (Deployment)

  - [x] 5.1 `next build`를 통한 정적 파일(out 폴더) 생성 테스트
  - [x] 5.2 Firebase Hosting 배포 및 라이브 환경 최종 점검

-----

<br>

## 🛠️ [하단] 상세 구현 명세 (Context for AI)

> 다음 개발 세션에서 AI가 참조할 상세 기술 가이드라인입니다.

### ⚠️ 필수 기술 제약 조건 (수정안 반영)

1.  **정적 라우팅 준수**: `output: 'export'` 설정에 따라 동적 경로(`[id]`)는 사용할 수 없습니다. 메인 페이지(`app/page.tsx`)에서 강의 보드를 직접 서비스하며, `useSearchParams()`를 통해 `?id=123` 형태의 데이터를 처리하십시오.
2.  **인증 범위 축소**: MVP 개발 속도를 위해 **Google 로그인만** 구현합니다. Kakao 로그인은 제외합니다.
3.  **순차적 처리(Non-Transaction)**: 파일 업로드와 DB 저장은 트랜잭션으로 묶지 말고, `Storage 업로드 성공 -> URL 획득 -> Firestore 문서 작성`의 순차적 비동기 로직으로 처리하십시오.

-----

### 상세 가이드

#### Phase 1: Setup & Auth

  - **Next.js**: `next.config.js`에 `output: 'export'`와 `trailingSlash: true`를 설정하여 Firebase Hosting 호환성을 높입니다.
  - **Admin 권한**: Firestore `users/{uid}` 문서의 `role` 필드가 `admin`인 경우만 관리자 메뉴를 노출합니다.

#### Phase 2: Lecture Hub

  - **라우팅 구조**:
      - 메인 보드: `/?id={lectureId}`
      - 라이브 모드: `/lecture/live?id={lectureId}` (또는 파라미터 분기)
  - **자료 업로드**: `firebase/storage`에 저장 후 다운로드 URL을 Firestore `materials` 컬렉션에 `lectureId`와 함께 저장합니다.

#### Phase 3: Q\&A Board

  - **실시간 리스너**: `useClient` 컴포넌트 내에서 `onSnapshot`을 호출하여 질문이 등록되면 자동으로 화면이 갱신되도록 합니다. (Admin의 Pin 기능 포함)

#### Phase 4: Mentoring (핵심 보안)

  - **예약 로직**:
    1.  사용자가 파일을 선택하고 예약 버튼을 누름.
    2.  `uploadBytes`로 Storage에 업로드 후 `getDownloadURL` 실행.
    3.  반환된 URL을 포함하여 `addDoc`으로 `bookings` 컬렉션에 데이터 저장.
  - **보안**: Firestore Rules에서 `bookings`의 `menteeId`가 현재 `auth.uid`와 일치하는 경우에만 Read를 허용하도록 설정하여 사업계획서 유출을 방지합니다.

#### Phase 5: Deployment

  - **배포 커맨드**: `next build` 결과물인 `out` 디렉토리가 Firebase Hosting의 `public` 디렉토리로 설정되었는지 `firebase.json`을 확인하십시오.

-----

**Compliance Checklist**

1.  **Hard Fail 1:** "Based on..." 등의 금지 문구 미사용 확인 (Pass)
2.  **Hard Fail 2:** 불필요한 개인 데이터 사용 여부 확인 (Pass)
3.  **Hard Fail 3:** 민감 정보 포함 여부 확인 (Pass)
4.  **Hard Fail 4:** 사용자 수정 이력 반영 확인 (Pass)

