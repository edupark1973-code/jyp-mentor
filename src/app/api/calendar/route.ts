import { google } from 'googleapis';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { date, time, duration = 60, menteeName, location, requestText, calendarId } = body;

    // 🔴 터미널 확인용 로그 추가
    console.log('📅 캘린더 API 호출됨:', { date, time, menteeName, calendarId });

    // 1. 환경 변수 체크
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;

    if (!clientEmail || !privateKey) {
      console.error('❌ 환경 변수 누락: GOOGLE_CLIENT_EMAIL 또는 GOOGLE_PRIVATE_KEY가 설정되지 않았습니다.');
      throw new Error('서버 환경 변수 설정이 누락되었습니다. (GOOGLE_CLIENT_EMAIL/PRIVATE_KEY)');
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/calendar.events'],
    });

    const calendar = google.calendar({ version: 'v3', auth });

    const startDateTime = new Date(`${date}T${time}:00+09:00`);
    const endDateTime = new Date(startDateTime.getTime() + duration * 60000);

    const event = {
      summary: `[멘토링] ${menteeName}님`,
      description: `📝 사전 요청사항:\n${requestText || '없음'}`,
      location: location || '온라인',
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: 'Asia/Seoul',
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: 'Asia/Seoul',
      },
    };

    const response = await calendar.events.insert({
      calendarId: calendarId || 'primary',
      requestBody: event,
    });

    console.log('✅ 구글 캘린더 등록 성공:', response.data.htmlLink);
    return NextResponse.json({ success: true, eventLink: response.data.htmlLink });
  } catch (error: any) {
    // 🔴 에러 발생 시 터미널에 상세 이유 출력
    console.error('❌ 캘린더 연동 에러 상세:', error.response?.data || error.message);
    return NextResponse.json(
      { success: false, error: error.message, details: error.response?.data }, 
      { status: 500 }
    );
  }
}