# Specification: 01_smtp_mailer-v2.md (Firebase Trigger Email 기반 알림 통합 가이드)

이 문서는 기존 `jyp-mentor.web.app` 서비스의 이메일 발송 인프라인 **Firebase Trigger Email Extension (Firestore `mail` 컬렉션 감시)**을 100% 재활용하여, 별도의 SMTP 패스워드 노출 없이 안전하고 안전하게 **멘토 피드백 실시간 알림 메일**을 연동하기 위한 개편 설계서입니다.

기존 코드의 중심 파일인 `src/lib/notifications.ts`에 기능을 안전하게 추가(Extension)하는 방식의 최적 경로를 다룹니다.

---

## 1. 개편 목표 및 장점
- **무서버리스 유지**: 별도의 SMTP 라이브러리(`nodemailer`)를 직접 가동하지 않고, Firebase Trigger Email의 확장 모듈을 유지하여 백엔드 비용 및 패스워드 유출 위협을 최소화합니다.
- **HTML 반응형 메일 지원**: `message.text` 뿐만 아니라 Firebase Trigger Email이 기본 지원하는 `message.html` 속성을 활용해 미려한 반응형 피드백 카드 디자인을 멘티에게 전송합니다.
- **안정적 큐(Queue) 처리**: Firestore에 문서가 등록되는 시점에 비동기로 메일이 전송되므로, 대량 메일 발송 시에도 서버 로드가 없고 발송 이력이 DB에 깔끔하게 남아 모니터링이 가능합니다.

---

## 2. 데이터 흐름 및 저장 스키마 (`mail` 컬렉션)

멘토가 멘티의 기획서를 검증하고 피드백을 완료하면 아래와 같은 구조로 Firestore `mail` 컬렉션에 문서를 추가(`addDoc`)하도록 시스템을 엮습니다.

### [추가되는 Firestore 문서 스키마 예시]
```typescript
{
  to: "mentee-email@example.com", // 수신할 멘티 이메일
  message: {
    subject: "[JYP 멘토링] 💡 새 멘토 피드백 및 사업 검증 결과가 도착했습니다",
    html: `HTML 본문 내용...` // 템플릿 파일 바인딩 결과물
  }
}
```

---

## 3. `src/lib/notifications.ts` 확장 가이드

기존에 예약 승인/거절 시 사용하던 `mail` 컬렉션 저장 패턴을 활용하여, 멘토 피드백 알림용 공통 함수인 **`sendMentorFeedbackNotification`**을 파일 내에 얹습니다.

```typescript
// src/lib/notifications.ts 내에 추가할 코드

import { addDoc, collection } from 'firebase/firestore';
import { db } from './firebase'; // 기존 firebase 인스턴스 경로에 맞춤

interface FeedbackNotificationParams {
  menteeEmail: string;
  menteeName: string;
  projectTitle: string;
  stepName: string;
  mentorCommentSummary: string;
  projectId: string;
}

/**
 * 멘티가 작성한 AI 사업계획서에 멘토 피드백 및 검증이 완료되었을 때 Firebase Trigger Email로 알림 메일을 전송합니다.
 */
export const sendMentorFeedbackNotification = async ({
  menteeEmail,
  menteeName,
  projectTitle,
  stepName,
  mentorCommentSummary,
  projectId
}: FeedbackNotificationParams) => {
  try {
    const emailHtml = getFeedbackEmailTemplate({
      menteeName,
      projectTitle,
      stepName,
      mentorCommentSummary,
      projectId
    });

    await addDoc(collection(db, 'mail'), {
      to: menteeEmail,
      message: {
        subject: `[JYP 멘토링] 💡 '${projectTitle}'에 대한 새로운 멘토 피드백이 등록되었습니다.`,
        html: emailHtml,
      },
    });

    console.log(`멘토 피드백 메일 발송 등록 완료 (수신: ${menteeEmail})`);
    return { success: true };
  } catch (error) {
    console.error('멘토 피드백 메일 발송 큐 등록 실패:', error);
    return { success: false, error };
  }
};

/**
 * 반응형 메일 템플릿 조립기 (HTML)
 */
const getFeedbackEmailTemplate = ({
  menteeName,
  projectTitle,
  stepName,
  mentorCommentSummary,
  projectId
}: Omit<FeedbackNotificationParams, 'menteeEmail'>): string => {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 20px; }
      .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid #e1e8ed; }
      .header { background-color: #1e3a8a; padding: 30px; text-align: center; color: #ffffff; }
      .header h1 { margin: 0; font-size: 20px; font-weight: 600; color: #ffffff !important; letter-spacing: -0.5px; }
      .content { padding: 40px 30px; color: #334155; line-height: 1.6; }
      .greeting { font-size: 16px; font-weight: bold; margin-bottom: 15px; color: #1e293b; }
      .info-box { background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 20px; border-radius: 4px; margin: 25px 0; }
      .info-item { margin-bottom: 8px; font-size: 14px; }
      .info-item strong { color: #1e293b; }
      .btn-container { text-align: center; margin-top: 35px; }
      .btn { display: inline-block; background-color: #3b82f6; color: #ffffff !important; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px; box-shadow: 0 4px 6px rgba(59,130,246,0.2); }
      .footer { background-color: #f1f5f9; padding: 20px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="header">
        <h1 style="color: #ffffff;">💡 새로운 멘토 피드백 도착</h1>
      </div>
      <div class="content">
        <div class="greeting">${menteeName} 창업가님, 반갑습니다!</div>
        <p>기획 중이신 AI 사업계획서에 멘토님의 정교한 비판적 피드백과 검증 코멘트가 업데이트되었습니다.</p>
        
        <div class="info-box">
          <div class="info-item"><strong>사업 아이템:</strong> ${projectTitle}</div>
          <div class="info-item"><strong>피드백 단계:</strong> ${stepName}</div>
          <div class="info-item"><strong>주요 피드백 내용:</strong></div>
          <p style="margin: 5px 0 0 0; font-size: 14px; color: #475569; font-style: italic;">
            "${mentorCommentSummary}"
          </p>
        </div>

        <p>멘토가 정밀하게 체크한 <strong>'사업 검증 및 결과 검증 체크리스트'</strong>의 세부 통과 항목을 확인하시고, 논리적 허점을 보완해 다음 단계 기획서 생성을 이어가시기 바랍니다.</p>
        
        <div class="btn-container">
          <a href="https://jyp-mentor.web.app/ai/workspace?projectId=${projectId}" class="btn" target="_blank" style="color: #ffffff;">내 워크스페이스 바로가기</a>
        </div>
      </div>
      <div class="footer">
        본 메일은 JYP 창업 멘토링 올인원 플랫폼에서 자동 발송되었습니다.<br>
        © JYP Mentoring Support Center. All Rights Reserved.
      </div>
    </div>
  </body>
  </html>
  `;
};
```,TargetFile: