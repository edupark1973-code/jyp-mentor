import type { Metadata } from 'next';
import ProfileClient from './profile-client';

export const metadata: Metadata = {
  title: '박정용 교수 | 창업 멘토',
  description: '박정용 교수의 소개와 창업 멘토링, 추천 채널을 만나보세요.',
  openGraph: { title: '박정용 교수 | 창업 멘토', description: '창업가를 위한 멘토링과 유용한 링크', images: [{ url: 'https://jyp-mentor.web.app/mentor-profile.jpg' }] },
};

export default function Page() { return <ProfileClient />; }
