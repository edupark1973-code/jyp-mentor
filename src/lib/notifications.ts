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
