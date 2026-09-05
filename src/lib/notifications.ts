import { doc, getDoc, collection, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { DESIGNATED_MENTOR_EMAIL } from '@/lib/userRole';

/**
 * 1. [강사 알림] 멘토링 예약 신청 시 강사에게 알림 발송 (디스코드 우선, 없으면 이메일)
 */
export async function sendMentoringNotification(
  instructorUid: string, 
  studentName: string, 
  date: string, 
  lectureTitle: string
) {
  try {
    const instructorDoc = await getDoc(doc(db, 'users', instructorUid));
    if (!instructorDoc.exists()) return;

    const instructorData = instructorDoc.data();
    const webhookUrl = instructorData.discordWebhookUrl;
    const instructorEmail = instructorData.email;

    const message = `🚨 **[새 예약 신청]**
👤 수강생: ${studentName}
📚 강좌명: ${lectureTitle}
🗓️ 희망일: ${date}

관리자 페이지에서 확인 후 수락해 주세요!`;

    if (webhookUrl) {
      // 디스코드 전송
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: message }),
      });
      console.log('강사 디스코드 알림 발송 완료!');
    } else if (instructorEmail) {
      // 이메일 전송 (mail 컬렉션 추가)
      await addDoc(collection(db, 'mail'), {
        to: instructorEmail,
        message: {
          subject: `[EduReport] 새로운 멘토링 예약 신청이 들어왔습니다.`,
          text: message,
        },
      });
      console.log('강사 이메일 알림 등록 완료!');
    }
  } catch (error) {
    console.error('강사 알림 발송 중 에러:', error);
  }
}

/**
 * 2. [멘티 알림] 예약 승인 시 멘티에게 승인 알림 메일 발송
 */
export async function sendMenteeApprovalNotification(
  menteeUid: string,
  lectureTitle: string,
  date: string,
  location: string
) {
  try {
    const menteeDoc = await getDoc(doc(db, 'users', menteeUid));
    if (!menteeDoc.exists()) return;

    const menteeEmail = menteeDoc.data().email;
    if (!menteeEmail) return;

    // URL을 클릭 가능한 형태로 텍스트 본문에 포함
    const textMessage = `안녕하세요! 신청하신 [${lectureTitle}] 멘토링 예약이 강사님에 의해 승인되었습니다.

🗓️ 일시: ${date}
📍 장소/링크: ${location}

정해진 시간에 늦지 않게 참여해 주세요. 감사합니다!`;

    await addDoc(collection(db, 'mail'), {
      to: menteeEmail,
      message: {
        subject: `🎉 [EduReport] 멘토링 예약이 승인되었습니다!`,
        text: textMessage,
      },
    });

    console.log('멘티에게 승인 알림 메일 발송 완료!');
  } catch (error) {
    console.error('멘티 알림 발송 중 에러:', error);
  }
}

/**
 * 🌟 3. [멘티 알림] 예약 거절(취소) 시 멘티에게 거절 사유와 함께 알림 메일 발송
 */
export async function sendMenteeRejectionNotification(
  menteeUid: string,
  lectureTitle: string,
  cancelReason: string
) {
  try {
    const menteeDoc = await getDoc(doc(db, 'users', menteeUid));
    if (!menteeDoc.exists()) return;

    const menteeEmail = menteeDoc.data().email;
    if (!menteeEmail) return;

    const textMessage = `안녕하세요. 신청하신 [${lectureTitle}] 멘토링 예약이 아래와 같은 사유로 아쉽게도 취소/반려되었습니다.

💬 강사님 메시지:
${cancelReason}

일정을 확인하신 후, 가능한 다른 시간대에 다시 신청해 주시기 바랍니다. 감사합니다.`;

    await addDoc(collection(db, 'mail'), {
      to: menteeEmail,
      message: {
        subject: `[EduReport] 멘토링 예약 취소/반려 안내`,
        text: textMessage,
      },
    });

    console.log('멘티에게 거절 사유 알림 메일 발송 완료!');
  } catch (error) {
    console.error('멘티 거절 알림 발송 중 에러:', error);
  }
}

export interface FeedbackNotificationParams {
  menteeEmail: string;
  menteeName: string;
  projectTitle: string;
  stepName: string;
  mentorCommentSummary: string;
  projectId: string;
}

/**
 * 멘토 피드백 등록 완료 시 Firebase Trigger Email 큐에 알림 메일을 추가합니다.
 */
export async function sendMentorFeedbackNotification({
  menteeEmail,
  menteeName,
  projectTitle,
  stepName,
  mentorCommentSummary,
  projectId,
}: FeedbackNotificationParams) {
  try {
    const emailHtml = getFeedbackEmailTemplate({
      menteeName,
      projectTitle,
      stepName,
      mentorCommentSummary,
      projectId,
    });

    await addDoc(collection(db, 'mail'), {
      to: menteeEmail,
      message: {
        subject: `[JYP 멘토링] 💡 '${projectTitle}'에 대한 새로운 멘토 피드백이 등록되었습니다.`,
        html: emailHtml,
      },
    });

    console.log(`멘토 피드백 메일 발송 등록 완료 (수신: ${menteeEmail})`);
    return { success: true as const };
  } catch (error) {
    console.error('멘토 피드백 메일 발송 큐 등록 실패:', error);
    return { success: false as const, error };
  }
}

export interface BusinessPlanReviewNotificationParams {
  menteeName: string;
  projectTitle: string;
  projectId: string;
}

/** 멘티가 최종 사업계획서 검토를 요청하면 담당 멘토에게 알림 메일을 보냅니다. */
export async function sendBusinessPlanReviewNotification({
  menteeName,
  projectTitle,
  projectId,
}: BusinessPlanReviewNotificationParams) {
  try {
    const safeMenteeName = escapeHtml(menteeName);
    const safeProjectTitle = escapeHtml(projectTitle);
    const reviewUrl = `https://jyp-mentor.web.app/admin/projects/${encodeURIComponent(projectId)}`;
    const emailHtml = `
    <!DOCTYPE html>
    <html lang="ko">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:20px;background:#f4f6f8;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#334155;">
      <div style="max-width:600px;margin:0 auto;overflow:hidden;border:1px solid #e1e8ed;border-radius:12px;background:#ffffff;">
        <div style="padding:30px;background:#047857;text-align:center;color:#ffffff;">
          <h1 style="margin:0;font-size:20px;color:#ffffff;">📄 사업계획서 검토 요청</h1>
        </div>
        <div style="padding:40px 30px;line-height:1.6;">
          <p style="margin-top:0;font-weight:bold;color:#1e293b;">${safeMenteeName} 멘티가 사업계획서 작성을 완료했습니다.</p>
          <p>아래 사업계획서를 검토하고 멘토 코멘트를 등록해 주세요.</p>
          <div style="margin:25px 0;padding:20px;border-left:4px solid #10b981;border-radius:4px;background:#f8fafc;">
            <strong style="color:#1e293b;">사업 아이템</strong><br>
            <span>${safeProjectTitle}</span>
          </div>
          <div style="margin-top:35px;text-align:center;">
            <a href="${reviewUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 28px;border-radius:8px;background:#059669;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;">사업계획서 검토하기</a>
          </div>
        </div>
        <div style="padding:20px;background:#f1f5f9;text-align:center;font-size:12px;color:#64748b;">
          본 메일은 JYP 창업 멘토링 올인원 플랫폼에서 자동 발송되었습니다.
        </div>
      </div>
    </body>
    </html>`;

    await addDoc(collection(db, 'mail'), {
      to: DESIGNATED_MENTOR_EMAIL,
      message: {
        subject: `[JYP 멘토링] 📄 '${projectTitle}' 사업계획서 검토 요청`,
        html: emailHtml,
      },
    });

    return { success: true as const };
  } catch (error) {
    console.error('사업계획서 검토 요청 메일 등록 실패:', error);
    return { success: false as const, error };
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[character] ?? character);
}

/** 반응형 멘토 피드백 이메일 HTML을 조립합니다. */
function getFeedbackEmailTemplate({
  menteeName,
  projectTitle,
  stepName,
  mentorCommentSummary,
  projectId,
}: Omit<FeedbackNotificationParams, 'menteeEmail'>): string {
  const safeMenteeName = escapeHtml(menteeName);
  const safeProjectTitle = escapeHtml(projectTitle);
  const safeStepName = escapeHtml(stepName);
  const safeComment = escapeHtml(mentorCommentSummary).replace(/\r?\n/g, '<br>');
  const workspaceUrl = `https://jyp-mentor.web.app/ai/workspace?projectId=${encodeURIComponent(projectId)}`;

  return `
  <!DOCTYPE html>
  <html lang="ko">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
      @media only screen and (max-width: 600px) { body { padding: 10px; } .content { padding: 30px 20px; } }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="header">
        <h1>💡 새로운 멘토 피드백 도착</h1>
      </div>
      <div class="content">
        <div class="greeting">${safeMenteeName} 창업가님, 반갑습니다!</div>
        <p>기획 중이신 AI 사업계획서에 멘토님의 비판적 피드백과 검증 코멘트가 업데이트되었습니다.</p>
        <div class="info-box">
          <div class="info-item"><strong>사업 아이템:</strong> ${safeProjectTitle}</div>
          <div class="info-item"><strong>피드백 단계:</strong> ${safeStepName}</div>
          <div class="info-item"><strong>주요 피드백 내용:</strong></div>
          <p style="margin: 5px 0 0; font-size: 14px; color: #475569; font-style: italic;">“${safeComment}”</p>
        </div>
        <p>멘토가 확인한 <strong>사업 검증 및 결과 검증 체크리스트</strong>의 세부 항목을 검토하고 다음 단계 기획을 이어가시기 바랍니다.</p>
        <div class="btn-container">
          <a href="${workspaceUrl}" class="btn" target="_blank" rel="noopener noreferrer">내 워크스페이스 바로가기</a>
        </div>
      </div>
      <div class="footer">
        본 메일은 JYP 창업 멘토링 올인원 플랫폼에서 자동 발송되었습니다.<br>
        © JYP Mentoring Support Center. All Rights Reserved.
      </div>
    </div>
  </body>
  </html>`;
}
