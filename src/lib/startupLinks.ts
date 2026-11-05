export type StartupLink = {
  id: string;
  title: string;
  url: string;
  category: string;
  description: string;
  order: number;
  hidden?: boolean;
};

export const STARTUP_LINK_CATEGORIES = ['창업 정보·네트워킹', '영상·강의자료', '지역별 창업 단톡'];

// 기존 구글 폼의 공개 링크. 같은 ID의 Firestore 문서가 있으면 관리자의 수정이 우선한다.
export const DEFAULT_STARTUP_LINKS: StartupLink[] = [
  { id: 'mentor-kakao', title: '박정용 창업멘토링 카카오톡 채널', url: 'http://pf.kakao.com/_zHzgn', category: '창업 정보·네트워킹', description: '창업 멘토링 소식을 카카오톡에서 받아보세요.', order: 0 },
  { id: 'facebook-group', title: '창업정보 페이스북 그룹', url: 'https://www.facebook.com/groups/changup4u/', category: '창업 정보·네트워킹', description: '창업정보 스크랩과 소식 공유', order: 1 },
  { id: 'naver-band', title: '창업정보 공유 네이버밴드', url: 'http://band.us/@changup4u', category: '창업 정보·네트워킹', description: '창업정보를 함께 나누는 밴드', order: 2 },
  { id: 'content-korea-lab', title: '대전 콘텐츠코리아랩 멘토링지원 단톡', url: 'https://open.kakao.com/o/gvBgtCAf', category: '창업 정보·네트워킹', description: '대전 콘텐츠 창업 멘토링 정보', order: 3 },
  { id: 'krcba-chat', title: '한국콘텐츠기업협회 단톡', url: 'https://open.kakao.com/o/gaYQiUCg', category: '창업 정보·네트워킹', description: '콘텐츠 기업 간 정보 공유', order: 4 },
  { id: 'krcba-site', title: '한국콘텐츠기업협회 홈페이지', url: 'https://www.krcba.org', category: '창업 정보·네트워킹', description: '협회 홈페이지', order: 5 },
  { id: 'sejong-chat', title: '세종로컬창업가협회 단톡', url: 'https://invite.kakao.com/tc/8925dASnuA', category: '창업 정보·네트워킹', description: '세종 지역 창업가 네트워킹', order: 6 },
  { id: 'sejong-site', title: '세종로컬창업가협회 홈페이지', url: 'https://sejonglocal.com', category: '창업 정보·네트워킹', description: '협회 홈페이지', order: 7 },
  { id: 'women-startup-chat', title: '대전여성새일센터 창업지원 단톡', url: 'https://open.kakao.com/o/gd3ZdjBg', category: '창업 정보·네트워킹', description: '여성 창업 지원 정보', order: 8 },
  { id: 'pet-coop-chat', title: '반려동물문화협동조합 단톡', url: 'https://open.kakao.com/o/gkVvYJff', category: '창업 정보·네트워킹', description: '반려동물 분야 네트워킹', order: 9 },
  { id: 'newsletter', title: '창업정보 뉴스레터 신청', url: 'https://pm100.stibee.com/', category: '창업 정보·네트워킹', description: '메일로 받아보는 창업정보', order: 10 },
  { id: 'djsa-chat', title: '대전융합포럼 D-JSA 단톡', url: 'https://invite.kakao.com/tc/oJc6BZJ7Gx', category: '창업 정보·네트워킹', description: '대전융합포럼 커뮤니티', order: 11 },
  { id: 'hannam-chat', title: '한남대 휴스사업단 대학생·기업 협의체 단톡', url: 'https://invite.kakao.com/tc/Eq3h8wGJDD', category: '창업 정보·네트워킹', description: '대학생과 기업의 교류', order: 12 },
  { id: 'harmonynet', title: '창업인터넷신문 하모니넷', url: 'http://harmonynet.kr/', category: '창업 정보·네트워킹', description: '창업 관련 뉴스', order: 13 },
  { id: 'contents-focus', title: '콘텐츠포커스 인터넷신문', url: 'https://contentsfocus.com/', category: '창업 정보·네트워킹', description: '콘텐츠 산업 소식', order: 14 },
  { id: 'startup-youtube', title: '창업강좌 유튜브 채널', url: 'https://www.youtube.com/@chagup4u', category: '영상·강의자료', description: '창업강좌 영상', order: 15 },
  { id: 'simschool', title: '사업계획서 작성 유튜브 채널 · 심스쿨', url: 'https://www.youtube.com/@심스쿨', category: '영상·강의자료', description: '사업계획서 작성 강의', order: 16 },
  { id: 'lecture-cafe', title: '창업 강의자료 네이버 카페', url: 'http://cafe.naver.com/bethestory', category: '영상·강의자료', description: '창업 강의자료 다운로드', order: 17 },
  { id: 'lecture-site', title: '창업 강의자료 사이트', url: 'https://jyp-mentor.web.app/', category: '영상·강의자료', description: '에듀리포트 강의자료', order: 18 },
  { id: 'free-ebooks', title: '전자출판 저술 무료 다운로드', url: 'https://edufiles.upaper.kr/', category: '영상·강의자료', description: '무료 전자책 자료', order: 19 },
  { id: 'mentor-blog', title: '사장처럼 일하라 블로그', url: 'http://blog.naver.com/edureport', category: '영상·강의자료', description: '창업과 경영에 관한 글', order: 20 },
  { id: 'giftlit', title: '소상공 카톡선물하기 기프트릿', url: 'http://gift.harmonynet.kr', category: '영상·강의자료', description: '소상공인을 위한 서비스', order: 21 },
  { id: 'vendor-list', title: '외주용역업체 추천목록', url: 'https://docs.google.com/spreadsheets/d/1VtDWasDablaCw7SY2odWi84BBp0sKDi2p8CBcRbA7ko/edit?gid=0#gid=0', category: '영상·강의자료', description: '추천 업체 목록 스프레드시트', order: 22 },
  { id: 'startup-profiles', title: '대전·세종 창업기업 프로필 모음', url: 'https://docs.google.com/presentation/d/1HjD6Xh3q7N1xka_ivJuncf0ou0xz2TfK/edit?slide=id.g3150c323bd2_0_0#slide=id.g3150c323bd2_0_0', category: '영상·강의자료', description: '지역 창업기업 소개 자료', order: 23 },
  { id: 'daejeon-chat', title: '대전·세종·충청 창업 단톡', url: 'http://bit.ly/대전창업단톡', category: '지역별 창업 단톡', description: '(사)한국창업기업가협회 · 입장코드 6244', order: 24 },
  { id: 'busan-chat', title: '부산·울산·경남 창업 단톡', url: 'http://bit.ly/부산창업단톡', category: '지역별 창업 단톡', description: '(사)글로벌창업지원네트워크 · 입장코드 1592', order: 25 },
  { id: 'gwangju-chat', title: '광주·전남 창업 단톡', url: 'http://bit.ly/광주창업단톡', category: '지역별 창업 단톡', description: '(사)창업지원네트워크 · 입장코드 062061', order: 26 },
  { id: 'daegu-chat', title: '대구·경북 창업 단톡', url: 'http://bit.ly/대구창업단톡', category: '지역별 창업 단톡', description: '(사)대구경북창업포럼 · 입장코드 053054', order: 27 },
  { id: 'daegu-sales-chat', title: '대경창업포럼 판로개척 단톡', url: 'http://bit.ly/대구판로개척단톡', category: '지역별 창업 단톡', description: '제2단톡 · 입장코드 054053', order: 28 },
];

export function isSafeExternalUrl(value: string): boolean {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}
