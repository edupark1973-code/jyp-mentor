
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase'; // Assuming firebase client is initialized and available
import { doc, getDoc, collection, addDoc } from 'firebase/firestore';

export async function POST(request: Request) {
  try {
    const { menteeUid, lectureTitle, date, location } = await request.json();

    // Ensure all required data is present
    if (!menteeUid || !lectureTitle || !date || !location) {
      return NextResponse.json({ error: '필수 데이터가 누락되었습니다.' }, { status: 400 });
    }

    // 1. Get mentee info from Firestore
    const menteeDoc = await getDoc(doc(db, 'users', menteeUid));
    if (!menteeDoc.exists()) {
      return NextResponse.json({ error: '멘티 정보를 찾을 수 없습니다.' }, { status: 404 });
    }
    const menteeEmail = menteeDoc.data()?.email;
    if (!menteeEmail) {
      return NextResponse.json({ error: '멘티 이메일 정보가 없습니다.' }, { status: 400 });
    }

    // 2. Add notification to 'mail' collection for processing
    await addDoc(collection(db, 'mail'), {
      to: menteeEmail,
      message: {
        subject: `🎉 [EduReport] 멘토링 예약이 승인되었습니다!`,
        text: `안녕하세요! 신청하신 [${lectureTitle}] 멘토링 예약이 강사님에 의해 승인되었습니다.

🗓️ 확정 일시: ${date}
📍 장소: ${location}

정해진 시간에 늦지 않게 참여해 주세요. 감사합니다!`,
      },
    });

    return NextResponse.json({ message: '멘티 승인 알림 메일 등록 완료!' });

  } catch (error: any) {
    console.error('API Error - Sending mentee approval notification:', error);
    return NextResponse.json({ error: error.message || '알림 메일 발송 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
