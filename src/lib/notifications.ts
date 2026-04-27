import { doc, getDoc, collection, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

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
