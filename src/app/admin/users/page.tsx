'use client';

import { useEffect, useState, Suspense } from 'react';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/useAuthStore';
import { ShieldCheck, UserCog, Loader2, ChevronLeft, Search, Download, Mail, Send, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

type UserRecord = {
  id: string;
  displayName?: string | null;
  email?: string | null;
  role?: string;
  createdAt?: unknown;
};

function getCreatedAtMillis(createdAt: unknown) {
  if (createdAt && typeof createdAt === 'object') {
    if ('toMillis' in createdAt && typeof createdAt.toMillis === 'function') {
      return createdAt.toMillis();
    }

    if ('toDate' in createdAt && typeof createdAt.toDate === 'function') {
      return createdAt.toDate().getTime();
    }
  }

  if (createdAt instanceof Date) return createdAt.getTime();
  if (typeof createdAt === 'string' || typeof createdAt === 'number') {
    const time = new Date(createdAt).getTime();
    return Number.isNaN(time) ? 0 : time;
  }

  return 0;
}

function formatCreatedAt(createdAt: unknown) {
  const time = getCreatedAtMillis(createdAt);
  if (!time) return '가입일 정보 없음';

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(time));
}

function AdminUserContent() {
  const router = useRouter();
  const { user, role, loading: authLoading } = useAuthStore();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isMailModalOpen, setIsMailModalOpen] = useState(false);
  const [mailSubject, setMailSubject] = useState('');
  const [mailBody, setMailBody] = useState('');
  const [isSendingMail, setIsSendingMail] = useState(false);
  const [mailSuccess, setMailSuccess] = useState('');

  useEffect(() => {
    if (authLoading) return;

    // 인증 확인이 끝난 뒤 멘토가 아니면 메인으로 이동한다.
    if (!user || role !== 'mentor') {
      router.replace('/');
      return;
    }

    // createdAt이 없는 기존 회원도 포함한 뒤 최신 가입자 순으로 정렬한다.
    const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      const fetchedUsers = snapshot.docs
        .map((userDoc) => ({ id: userDoc.id, ...userDoc.data() }) as UserRecord)
        .sort((a, b) => getCreatedAtMillis(b.createdAt) - getCreatedAtMillis(a.createdAt));

      setUsers(fetchedUsers);
    }, (error) => {
      console.error('Firestore user query error:', error);
    });

    return () => unsub();
  }, [user, role, authLoading, router]);

  const toggleMentor = async (targetUser: UserRecord) => {
    const newRole = targetUser.role === 'mentor' ? 'mentee' : 'mentor';
    const message = newRole === 'mentor'
      ? `[${targetUser.displayName}] 님에게 관리자(강사) 권한을 부여하시겠습니까?`
      : `[${targetUser.displayName}] 님의 관리자 권한을 회수하시겠습니까?`;

    if (confirm(message)) {
      try {
        await updateDoc(doc(db, 'users', targetUser.id), { role: newRole });
        alert('권한이 변경되었습니다.');
      } catch (e) {
        console.error(e);
        alert('권한 변경 중 오류가 발생했습니다.');
      }
    }
  };

  const filteredUsers = users.filter(u => 
    u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const recipientCount = new Set(users
    .map((target) => target.email?.trim().toLowerCase() ?? '')
    .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))).size;
  const canSendBulkEmail = user?.email?.trim().toLowerCase() === 'edupark1973@gmail.com';

  const downloadRoster = async () => {
    const rows = [
      ['사용자 ID', '이름', '이메일', '권한', '가입일'],
      ...users.map((target) => [
        target.id,
        target.displayName || '',
        target.email || '',
        target.role === 'mentor' ? '강사' : '수강생',
        formatCreatedAt(target.createdAt),
      ]),
    ];
    const escapeXml = (value: string) => value
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
    const columnName = (columnNumber: number) => {
      let name = '';
      let number = columnNumber;
      while (number > 0) {
        const remainder = (number - 1) % 26;
        name = String.fromCharCode(65 + remainder) + name;
        number = Math.floor((number - 1) / 26);
      }
      return name;
    };
    const sheetRows = rows.map((row, rowIndex) => {
      const cells = row.map((value, columnIndex) => {
        const cellRef = `${columnName(columnIndex + 1)}${rowIndex + 1}`;
        return `<c r="${cellRef}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
      }).join('');
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    }).join('');

    const zipModule = await import('jszip');
    const zip = new zipModule.default();
    zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>');
    zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
    zip.file('xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="사용자 명단" sheetId="1" r:id="rId1"/></sheets></workbook>');
    zip.file('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>');
    zip.file('xl/worksheets/sheet1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`);

    const workbook = await zip.generateAsync({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const blobUrl = URL.createObjectURL(workbook);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `EduReport_사용자명단_${new Date().toISOString().slice(0, 10)}.xlsx`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  };

  const sendBulkEmail = async () => {
    if (!mailSubject.trim() || !mailBody.trim()) {
      alert('메일 제목과 내용을 입력해 주세요.');
      return;
    }
    if (recipientCount === 0) {
      alert('메일을 받을 수 있는 사용자 이메일이 없습니다.');
      return;
    }
    if (!confirm(`이메일 주소가 등록된 사용자 ${recipientCount}명에게 단체 메일을 보내시겠습니까?`)) return;

    setIsSendingMail(true);
    setMailSuccess('');
    try {
      const token = await user?.getIdToken();
      if (!token) throw new Error('로그인이 필요합니다. 다시 로그인해 주세요.');
      const response = await fetch('/api/admin/bulk-email', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subject: mailSubject, text: mailBody }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '단체 메일 발송에 실패했습니다.');
      setMailSuccess(`${result.recipients}명에게 메일 발송 대기열을 등록했습니다.`);
      setMailSubject('');
      setMailBody('');
    } catch (error) {
      alert(error instanceof Error ? error.message : '단체 메일 발송에 실패했습니다.');
    } finally {
      setIsSendingMail(false);
    }
  };

  if (authLoading) return <div className="h-screen flex items-center justify-center bg-white"><Loader2 className="animate-spin text-blue-600" /></div>;
  if (role !== 'mentor') return null;

  return (
    <div className="min-h-screen bg-slate-50 p-8 text-slate-900">
      <div className="max-w-4xl mx-auto">
        <header className="mb-10 flex flex-col gap-5">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/')} className="p-3 bg-white rounded-2xl shadow-sm hover:bg-slate-100 transition-all">
              <ChevronLeft size={20} />
            </button>
            <h1 className="text-3xl font-black flex items-center gap-3">
              <UserCog className="text-blue-600" size={32} /> 강사 및 사용자 관리
            </h1>
          </div>
          <div className="flex flex-wrap items-center justify-start gap-2">
            <button type="button" onClick={downloadRoster} className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-100">
              <Download size={17} /> 명단 엑셀 다운로드
            </button>
            {canSendBulkEmail && (
              <button type="button" onClick={() => { setMailSuccess(''); setIsMailModalOpen(true); }} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-blue-100 transition hover:bg-blue-700">
                <Mail size={17} /> 단체 메일
              </button>
            )}
            <div className="px-5 py-2 bg-blue-600 text-white rounded-full font-black text-sm shadow-lg shadow-blue-100">
              총 {users.length}명 가입됨
            </div>
          </div>
        </header>

        {/* 검색바 */}
        <div className="relative mb-8">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="이름 또는 이메일로 검색..." 
            className="w-full pl-14 pr-6 py-4 bg-white border border-slate-100 rounded-[1.5rem] shadow-sm outline-none focus:border-blue-500 font-bold"
          />
        </div>

        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-50 text-slate-400 text-xs font-black uppercase tracking-widest">
                <th className="px-8 py-5">사용자 정보</th>
                <th className="px-8 py-5">가입일</th>
                <th className="px-8 py-5">현재 권한</th>
                <th className="px-8 py-5 text-right">권한 변경</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredUsers.map((target) => (
                <tr key={target.id} className="hover:bg-slate-50/30 transition-colors">
                  <td className="px-8 py-6">
                    <p className="font-black text-lg">{target.displayName}</p>
                    <p className="text-slate-400 text-xs font-bold">{target.email}</p>
                  </td>
                  <td className="px-8 py-6 whitespace-nowrap">
                    <p className="text-sm font-bold text-slate-600">{formatCreatedAt(target.createdAt)}</p>
                  </td>
                  <td className="px-8 py-6">
                    {target.role === 'mentor' ? (
                      <span className="flex items-center gap-1.5 text-blue-600 font-black text-xs uppercase bg-blue-50 px-3 py-1.5 rounded-full w-fit">
                        <ShieldCheck size={14} /> Instructor
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-slate-400 font-black text-xs uppercase bg-slate-100 px-3 py-1.5 rounded-full w-fit">
                        Student
                      </span>
                    )}
                  </td>
                  <td className="px-8 py-6 text-right">
                    {/* 자기 자신의 권한은 변경 못하게 처리 */}
                    {target.id !== user?.uid && (
                      <button 
                        onClick={() => toggleMentor(target)}
                        className={`px-4 py-2 rounded-xl font-black text-xs transition-all ${
                          target.role === 'mentor'
                          ? 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          : 'bg-slate-900 text-white hover:bg-black shadow-lg shadow-slate-200'
                        }`}
                      >
                        {target.role === 'mentor' ? '권한 회수' : '강사 임명'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredUsers.length === 0 && (
            <div className="py-20 text-center text-slate-300 font-bold italic">검색 결과가 없습니다.</div>
          )}
        </div>

        {isMailModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSendingMail) setIsMailModalOpen(false); }}>
            <div role="dialog" aria-modal="true" aria-labelledby="bulk-mail-title" className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
              <button type="button" onClick={() => setIsMailModalOpen(false)} disabled={isSendingMail} aria-label="단체 메일 작성 닫기" className="absolute right-5 top-5 rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"><X size={20} /></button>
              <div className="pr-10">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">Admin Email</p>
                <h2 id="bulk-mail-title" className="mt-2 text-2xl font-black text-slate-950">사용자 단체 메일</h2>
                <p className="mt-2 text-sm font-semibold text-slate-500">관리자 Google 메일 주소로 이메일이 등록된 사용자 {recipientCount}명에게 숨은 참조로 발송합니다.</p>
              </div>
              <div className="mt-6 space-y-4">
                <div>
                  <label htmlFor="bulk-mail-subject" className="mb-2 block text-xs font-black text-slate-500">메일 제목</label>
                  <input id="bulk-mail-subject" value={mailSubject} onChange={(event) => setMailSubject(event.target.value)} maxLength={200} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-slate-900 outline-none transition focus:border-blue-500" placeholder="메일 제목을 입력하세요" />
                </div>
                <div>
                  <label htmlFor="bulk-mail-body" className="mb-2 block text-xs font-black text-slate-500">메일 내용</label>
                  <textarea id="bulk-mail-body" value={mailBody} onChange={(event) => setMailBody(event.target.value)} maxLength={30000} rows={10} className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium leading-6 text-slate-900 outline-none transition focus:border-blue-500" placeholder="메일 내용을 입력하세요" />
                  <p className="mt-1 text-right text-xs font-semibold text-slate-400">{mailBody.length.toLocaleString()} / 30,000자</p>
                </div>
              </div>
              {mailSuccess && <p role="status" className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{mailSuccess}</p>}
              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setIsMailModalOpen(false)} disabled={isSendingMail} className="rounded-xl bg-slate-100 px-5 py-3 font-black text-slate-600 transition hover:bg-slate-200 disabled:opacity-50">닫기</button>
                <button type="button" onClick={() => void sendBulkEmail()} disabled={isSendingMail || !mailSubject.trim() || !mailBody.trim() || recipientCount === 0} className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-black text-white shadow-lg shadow-blue-100 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                  {isSendingMail ? <Loader2 className="animate-spin" size={18} /> : <Send size={17} />}
                  {isSendingMail ? '발송 대기열 등록 중...' : `${recipientCount}명에게 보내기`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminUserPage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center bg-white"><Loader2 className="animate-spin text-blue-600" /></div>}>
      <AdminUserContent />
    </Suspense>
  );
}
