import type { Metadata } from 'next';
import StartupLinksClient from './StartupLinksClient';

export const metadata: Metadata = {
  title: '창업가를 위한 추천 링크 | EduReport',
  description: '창업 정보 커뮤니티, 강의자료, 지역별 네트워킹 채널을 한곳에서 찾아보세요.',
  openGraph: {
    title: '창업가를 위한 추천 링크 | EduReport',
    description: '창업에 필요한 정보와 사람을 연결하는 추천 링크 모음',
    type: 'website',
  },
};

export default function StartupLinksPage() {
  return <StartupLinksClient />;
}
