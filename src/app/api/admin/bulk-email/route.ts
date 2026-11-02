import { getFirebaseAdmin } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';

const ADMIN_EMAIL = 'edupark1973@gmail.com';
const MAX_SUBJECT_LENGTH = 200;
const MAX_BODY_LENGTH = 30_000;
const RECIPIENTS_PER_MESSAGE = 50;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization');
  return authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
}

export async function POST(request: Request) {
  try {
    const token = getBearerToken(request);
    if (!token) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });

    const { adminAuth, adminDb } = getFirebaseAdmin();
    const decodedToken = await adminAuth.verifyIdToken(token);
    if (decodedToken.email?.trim().toLowerCase() !== ADMIN_EMAIL || !decodedToken.email_verified) {
      return Response.json({ error: '관리자 계정만 단체 메일을 보낼 수 있습니다.' }, { status: 403 });
    }

    const payload = await request.json().catch(() => null);
    const subject = typeof payload?.subject === 'string' ? payload.subject.replace(/[\r\n]+/g, ' ').trim() : '';
    const text = typeof payload?.text === 'string' ? payload.text.trim() : '';
    if (!subject || !text) {
      return Response.json({ error: '제목과 내용을 입력해 주세요.' }, { status: 400 });
    }
    if (subject.length > MAX_SUBJECT_LENGTH || text.length > MAX_BODY_LENGTH) {
      return Response.json({ error: '제목은 200자, 내용은 30,000자 이하로 입력해 주세요.' }, { status: 400 });
    }

    const userSnapshot = await adminDb.collection('users').get() as {
      docs: Array<{ data: () => Record<string, unknown> }>;
    };
    const recipients: string[] = [...new Set<string>(userSnapshot.docs
      .map((userDoc) => String(userDoc.data().email ?? '').trim().toLowerCase())
      .filter((email) => EMAIL_PATTERN.test(email)))];

    if (recipients.length === 0) {
      return Response.json({ error: '메일을 받을 수 있는 사용자 이메일이 없습니다.' }, { status: 422 });
    }

    const recipientGroups: string[][] = [];
    for (let index = 0; index < recipients.length; index += RECIPIENTS_PER_MESSAGE) {
      recipientGroups.push(recipients.slice(index, index + RECIPIENTS_PER_MESSAGE));
    }

    for (let start = 0; start < recipientGroups.length; start += 450) {
      const batch = adminDb.batch();
      recipientGroups.slice(start, start + 450).forEach((bcc) => {
        const mailRef = adminDb.collection('mail').doc();
        batch.set(mailRef, {
          from: `EduReport 관리자 <${ADMIN_EMAIL}>`,
          replyTo: ADMIN_EMAIL,
          bcc,
          message: { subject, text },
          createdBy: decodedToken.uid,
        });
      });
      await batch.commit();
    }

    return Response.json({ success: true, recipients: recipients.length, queuedMessages: recipientGroups.length });
  } catch (error) {
    console.error('관리자 단체 메일 등록 실패:', error);
    return Response.json({ error: '단체 메일 발송 대기열 등록에 실패했습니다.' }, { status: 500 });
  }
}
