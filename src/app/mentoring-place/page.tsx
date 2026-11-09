import Link from 'next/link';

const steps = [
  '한남대학교 정문보다 동대전고등학교 쪽 후문으로 진입하시는 것이 좋습니다.',
  '후문으로 들어오면 왼쪽에 주차장이 있습니다. 주차권을 드립니다.',
  '문과대학 입구로 들어가면 언덕 입구이기 때문에 바로 2층입니다.',
  '들어와서 왼쪽으로 돌아 계단을 올라가세요. 사업단은 3층에 있습니다. 실제로는 한 층만 올라가면 됩니다.',
  '계단을 올라오면 정면에 취업준비실 푯말이 보입니다. 그 아래에 사무실이 있습니다.',
  '푯말 아래 4-03-33호가 사무실입니다. 회의는 맞은편 회의실에서 하기도 합니다.',
];

export default function MentoringPlacePage() {
  return <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-900"><div className="mx-auto max-w-4xl">
    <Link href="/profile" className="text-sm font-bold text-blue-700">← 멘토 소개로 돌아가기</Link>
    <header className="mb-10 mt-6"><p className="text-sm font-bold text-blue-700">MENTORING LOCATION</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">멘토링 장소 안내</h1><p className="mt-4 text-lg text-slate-600">한남대학교 문과대학 3층 · 4-03-33호</p></header>
    <div className="grid gap-6 sm:grid-cols-2">{steps.map((step, index) => <section key={step} className="overflow-hidden rounded-2xl bg-white shadow-sm"><img src={`/mentoring-place/step-${index + 1}.jpg`} alt={`${index + 1}단계 안내 사진`} className="aspect-video w-full object-cover" /><div className="p-5"><p className="mb-2 text-sm font-bold text-blue-700">STEP {String(index + 1).padStart(2, '0')}</p><p className="leading-7">{step}</p></div></section>)}</div>
  </div></main>;
}
