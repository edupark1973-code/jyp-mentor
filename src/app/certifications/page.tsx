import type { Metadata } from 'next';
import { Award, Building2, CircleAlert, ExternalLink } from 'lucide-react';

export const metadata: Metadata = {
  title: '민간자격증 정보공시 | EduReport',
  description: '미래지식융합협회의 민간자격 등록정보, 비용, 환불규정 및 자격관리기관 안내',
  openGraph: {
    title: '미래지식융합협회 민간자격증 정보공시',
    description: '민간자격 등록정보와 비용, 환불규정을 확인하세요.',
    type: 'website',
  },
};

const certifications = [
  { number: '①', title: '창업교육전문가 1급', name: '창업교육전문가 1급', registration: '2026-000165', ministry: '중소벤처기업부', partner: '창업교육협동조합' },
  { number: '②', title: '스피치프레젠테이션 1급 · 2급', name: '스피치프레젠테이션 1급, 2급', registration: '2026-000166', ministry: '교육부', partner: '한국콘텐츠기업협회' },
];

export default function CertificationsPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="bg-slate-950 px-4 py-16 text-white sm:py-20">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-black tracking-[0.22em] text-blue-300">PRIVATE QUALIFICATION</p>
          <h1 className="mt-4 text-3xl font-black leading-tight tracking-tight sm:text-5xl">미래지식융합협회<br />민간자격증 정보공시</h1>
          <p className="mt-6 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">미래지식융합협회는 창업·교육·콘텐츠 분야를 중심으로 미래 사회에 필요한 전문 인재를 양성하고, 실무 중심의 교육 콘텐츠 개발과 자격제도 운영을 통해 개인과 조직의 경쟁력 강화를 지원하는 비영리 단체입니다.</p>
          <p className="mt-3 text-sm leading-7 text-slate-300 sm:text-base">본 협회는 자격기본법에 따라 등록된 민간자격을 체계적으로 운영·관리하고 있습니다.</p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 pb-20 pt-12 sm:px-6">
        <div className="mb-8"><p className="text-xs font-black tracking-[0.2em] text-blue-600">QUALIFICATIONS</p><h2 className="mt-2 text-2xl font-black sm:text-3xl">협회 보유 민간자격증 안내</h2><p className="mt-3 leading-7 text-slate-600">미래지식융합협회는 다음의 민간자격증을 운영하며, 각 자격의 상세 정보를 자격기본법에 따른 정보공시 기준에 맞추어 공개합니다.</p></div>

        <div className="space-y-6">
          {certifications.map(certification => <section key={certification.registration} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-start gap-4 border-b border-slate-100 bg-blue-50/60 p-6 sm:p-8"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white"><Award size={24} /></span><div><p className="text-xs font-bold text-blue-600">민간자격증 {certification.number}</p><h3 className="mt-1 text-xl font-black sm:text-2xl">{certification.title}</h3></div></div>
            <dl className="divide-y divide-slate-100 px-6 sm:px-8">
              <div className="grid gap-1 py-5 sm:grid-cols-[150px_1fr] sm:gap-5"><dt className="text-sm font-bold text-slate-500">자격명</dt><dd className="font-bold">{certification.name}</dd></div>
              <div className="grid gap-1 py-5 sm:grid-cols-[150px_1fr] sm:gap-5"><dt className="text-sm font-bold text-slate-500">자격의 종류</dt><dd>등록민간자격</dd></div>
              <div className="grid gap-1 py-5 sm:grid-cols-[150px_1fr] sm:gap-5"><dt className="text-sm font-bold text-slate-500">등록번호</dt><dd><strong>{certification.registration}</strong><span className="ml-3 text-sm text-slate-500">주무부처: {certification.ministry}</span></dd></div>
              <div className="grid gap-1 py-5 sm:grid-cols-[150px_1fr] sm:gap-5"><dt className="text-sm font-bold text-slate-500">자격발급기관</dt><dd className="leading-7">미래지식융합협회<br /><span className="text-sm text-slate-600">(공동운영기관: {certification.partner})</span></dd></div>
              <div className="grid gap-1 py-5 sm:grid-cols-[150px_1fr] sm:gap-5"><dt className="text-sm font-bold text-slate-500">총비용 (세부내역)</dt><dd className="space-y-2 leading-7"><p className="font-bold">총비용: 교육과정비 + 자격발급비</p><p>운영기관별 교육과정비는 교육비, 응시료 및 회원혜택 등을 모집 시 별도 공지합니다.</p><p>협회 자격발급비: <strong>25,000원</strong></p></dd></div>
              <div className="grid gap-1 py-5 sm:grid-cols-[150px_1fr] sm:gap-5"><dt className="text-sm font-bold text-slate-500">환불규정</dt><dd className="space-y-2 leading-7"><p>응시료는 접수마감 전까지 100% 환불되며, 검정 당일 취소 시 30% 공제 후 환불됩니다.</p><p>자격발급비는 합격자에 한하며, 자격증 제작·발송 전 취소 시 100% 환불되고 이후에는 환급되지 않습니다.</p></dd></div>
            </dl>
          </section>)}
        </div>

        <section className="mt-10 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><h2 className="flex items-center gap-3 text-xl font-black"><Building2 className="text-blue-600" size={23} />자격관리·운영(발급)기관 정보</h2><dl className="mt-5 grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">{[['기관명', '미래지식융합협회'], ['대표자', '박남구'], ['연락처', '042-535-3455'], ['이메일', 'edufiles@daum.net'], ['소재지', '대전광역시 중구 센트리아오피스텔 3F']].map(([label, value]) => <div key={label}><dt className="font-bold text-slate-500">{label}</dt><dd className="mt-1 font-semibold text-slate-900">{value}</dd></div>)}<div><dt className="font-bold text-slate-500">홈페이지</dt><dd className="mt-1"><a href="https://harmonynet.kr" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-bold text-blue-600 hover:underline">harmonynet.kr <ExternalLink size={14} /></a></dd></div></dl></section>

        <section className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-6 sm:p-8"><h2 className="flex items-center gap-3 text-xl font-black text-amber-950"><CircleAlert size={23} />소비자 알림 사항</h2><div className="mt-4 space-y-3 text-sm leading-7 text-amber-950"><p>① 상기 자격은 자격기본법 규정에 따라 등록한 민간자격으로, 국가로부터 인정받은 공인자격이 아닙니다.</p><p>② 민간자격 등록 및 공인 제도에 관한 상세 내용은 <a href="https://www.pqi.or.kr/" target="_blank" rel="noopener noreferrer" className="font-bold underline underline-offset-2">민간자격정보서비스(www.pqi.or.kr)</a>의 ‘민간자격 소개’를 참고하십시오.</p></div></section>
      </div>
    </div>
  );
}
