import { doc, getDoc, collection, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase'; // 강사님의 firebase 설정 경로에 맞게 수정

/**
 * 멘토링 예약 완료 시 강사에게 알림을 보내는 하이브리드 함수
 * @param instructorUid 알림을 받을 강사의 UID
 * @param studentName 신청한 수강생 이름
 * @param date 신청 날짜/시간
 * @param lectureTitle 강좌명
 */
export async function sendMentoringNotification(
  instructorUid: string, 
  studentName: string, 
  date: string, 
  lectureTitle: string
) {
  try {
    // 1. 알림을 받을 강사의 프로필 데이터를 DB에서 가져옵니다.
    const instructorDoc = await getDoc(doc(db, 'users', instructorUid));
    if (!instructorDoc.exists()) return;

    const instructorData = instructorDoc.data();
    const webhookUrl = instructorData.discordWebhookUrl; // 1단계에서 저장한 디스코드 주소
    const instructorEmail = instructorData.email; // 강사 가입 시 저장된 이메일 (또는 수동 입력)

    // 전송할 공통 메시지 내용
    const message = `🚨 **[새 예약 신청]**\n👤 수강생: ${studentName}\n📚 강좌명: ${lectureTitle}\n🗓️ 희망일: ${date}\n\n관리자 페이지에서 확인 후 수락해 주세요!`;

    // 2. 라우팅(분기) 처리: 디스코드가 1순위, 없으면 이메일!
    if (webhookUrl) {
      // 🟢 [디스코드 전송]
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: message }),
      });
      console.log('디스코드 알림 발송 완료!');

    } else if (instructorEmail) {
      // 🟡 [이메일 전송] (Firebase Trigger Email 익스텐션 사용 시)
      // 'mail' 컬렉션에 문서를 추가하기만 하면 Firebase가 알아서 메일을 쏴줍니다.
      await addDoc(collection(db, 'mail'), {
        to: instructorEmail,
        message: {
          subject: `[EduReport] 새로운 멘토링 예약 신청이 들어왔습니다.`,
          text: message, // 메일 본문
        },
      });
      console.log('이메일 알림 발송 완료 (메일 큐에 등록됨)!');
    }

  } catch (error) {
    console.error('알림 발송 중 시스템 에러:', error);
  }
}