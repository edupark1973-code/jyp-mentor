# \# 📄 PRD: 강사·멘토 통합 관리 서비스 (EduFiles MVP)

# 

# \## 1. 제품 개요

# \- \*\*한 줄 정의\*\*: 강사 1인이 강의 자료 공유, 실시간 질의응답, 멘토링 예약을 한 곳에서 관리하는 올인원 플랫폼.

# \- \*\*배포 환경\*\*: Firebase (Hosting, Firestore, Auth, Storage)

# \- \*\*개발 원칙\*\*: AI 코딩 도구를 100% 활용하여 개발하며, 복잡한 실시간 통신보다는 비동기식(Polling/Snapshot) 처리를 우선한다.

# 

# \## 2. 핵심 사용자 가치

# 1\. \*\*자료 휘발 방지\*\*: 카톡이나 패들렛에 흩어진 자료를 하나의 링크로 영구 보관.

# 2\. \*\*보안성 확보\*\*: 사업계획서 등 민감 자료는 소셜 로그인을 통해 본인만 확인.

# 3\. \*\*운영 효율화\*\*: 멘토링 가용 시간을 미리 올려두어 불필요한 커뮤니케이션 비용 감소.

# 

# \## 3. 주요 기능 명세 (Firebase 기반)

# 

# \### 3.1 회원가입 및 권한 (Firebase Auth)

# \- \*\*인증\*\*: 구글 및 카카오 소셜 로그인.

# \- \*\*권한\*\*: 

# &#x20; - `Admin`: 강의 생성, 자료 업로드, 멘토링 슬롯 관리, 모든 피드백 작성.

# &#x20; - `User`: 질문 작성, 멘토링 예약, 본인 제출 자료 및 피드백 조회.

# &#x20; - `Guest`: 공유 링크를 통한 강의 자료 열람 및 다운로드 (로그인 불필요).

# 

# \### 3.2 강의 자료 허브 (Firestore \& Storage)

# \- \*\*강의 생성\*\*: 제목, 설명, 대표 이미지 설정.

# \- \*\*자료 업로드\*\*: PDF, PPT 파일을 Firebase Storage에 저장하고 링크 공유.

# \- \*\*라이브 모드\*\*: 강의 현장에서 활용 가능한 전체화면 뷰어 모드 (주요 질문 및 공지 강조 UI).

# 

# \### 3.3 비동기 Q\&A 게시판

# \- \*\*기능\*\*: 강의별 질문 등록, 답변 댓글, 운영자의 주요 공지 상단 고정(Pin).

# \- \*\*실시간성\*\*: Firebase SDK의 `onSnapshot`을 활용하여 수동 새로고침 없이 업데이트 반영.

# 

# \### 3.4 멘토링 예약 시스템

# \- \*\*슬롯 관리\*\*: 운영자가 날짜/시간별 예약 가능 슬롯 생성.

# \- \*\*예약 프로세스\*\*: 유저가 슬롯 선택 -> 사업계획서 업로드(필수) -> 즉시 확정.

# \- \*\*피드백\*\*: 운영자가 멘티의 예약 내역에 텍스트 답변 및 수정 파일 업로드.

# 

# \## 4. 데이터 모델 (Firestore)

# \- \*\*users\*\*: { uid, email, displayName, role }

# \- \*\*lectures\*\*: { id, title, description, createdAt }

# \- \*\*materials\*\*: { id, lectureId, fileName, fileUrl, type }

# \- \*\*questions\*\*: { id, lectureId, userId, content, isPinned, createdAt }

# \- \*\*mentoring\_slots\*\*: { id, startAt, endAt, isBooked, bookedBy }

# \- \*\*bookings\*\*: { id, slotId, menteeId, submittedFileUrl, feedbackText, feedbackFileUrl }

# 

# \## 5. 기술 스택 (AI Native Stack)

# \- \*\*Frontend\*\*: Next.js 14+ (App Router), Tailwind CSS, Shadcn UI (컴포넌트 라이브러리)

# \- \*\*Backend\*\*: Firebase

# &#x20; - Firestore (Database)

# &#x20; - Firebase Auth (Authentication)

# &#x20; - Cloud Storage (File Upload)

# \- \*\*Deployment\*\*: Firebase Hosting

# 

# \## 6. 개발 단계 (Milestones)

# \- \*\*Phase 1\*\*: Firebase 프로젝트 설정 및 소셜 로그인 구현.

# \- \*\*Phase 2\*\*: 강의 생성 및 자료 업로드/다운로드 (Storage 연동).

# \- \*\*Phase 3\*\*: Q\&A 게시판 및 라이브 모드 UI 구현.

# \- \*\*Phase 4\*\*: 멘토링 슬롯 예약 및 피드백 기능 (보안 RLS 규칙 적용).

# \- \*\*Phase 5\*\*: Firebase Hosting 배포 및 최종 테스트.

# 

# \## 7. 보안 및 RLS 규칙 (Firebase Security Rules)

# \- `bookings` 컬렉션의 문서는 `request.auth.uid == resource.data.menteeId` 또는 운영자 계정만 읽기/쓰기가 가능해야 함.

