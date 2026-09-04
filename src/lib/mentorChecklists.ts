export interface ChecklistItem {
  id: string;
  label: string;
}

export interface ChecklistGroup {
  title: string;
  items: ChecklistItem[];
}

export type ChecklistState = Record<string, boolean>;

export const BUSINESS_CHECKLIST_GROUPS: ChecklistGroup[] = [
  {
    title: '핵심 가치 증명',
    items: [
      { id: 'painPointSolutionFit', label: "절실한 문제(Pain-Point)와 해결책이 명확하게 연결됨을 증명했는가?" },
      { id: 'uniqueValue', label: '기존 대안과 비교해 독보적인 가치와 우월성을 설명했는가?' },
      { id: 'quantifiedValue', label: '고객 가치를 비용·시간 등의 구체적인 숫자로 정량화했는가?' },
      { id: 'customerEvidence', label: '고객의 목소리나 실제 사용 데이터로 핵심 가치를 증명했는가?' },
    ],
  },
  {
    title: '시장 기회 검증',
    items: [
      { id: 'whyNow', label: '기술·사회적 변곡점을 근거로 왜 지금 시작해야 하는지 증명했는가?' },
      { id: 'marketSize', label: 'TAM·SAM·SOM을 Top-down과 Bottom-up으로 교차 검증했는가?' },
      { id: 'marketProfitability', label: '시장 구조 분석을 통해 높은 수익 가능성의 근거를 제시했는가?' },
      { id: 'beachheadMarket', label: '가장 먼저 진입할 교두보 시장을 명확히 정의했는가?' },
    ],
  },
  {
    title: '경쟁 전략 수립 검증',
    items: [
      { id: 'allAlternatives', label: '직접 경쟁사부터 아무것도 하지 않는 선택까지 모든 대안을 식별했는가?' },
      { id: 'valueCurve', label: '전략 캔버스로 차별화된 가치 곡선을 증명했는가?' },
      { id: 'vrioMoat', label: '핵심 역량이 VRIO 기반의 지속 가능한 경제적 해자임을 입증했는가?' },
      { id: 'strategicTradeoff', label: '무엇을 포기하고 어디에 집중할지 전략적 Trade-off가 명확한가?' },
    ],
  },
  {
    title: '비즈니스 모델 검증',
    items: [
      { id: 'ltvCac', label: 'LTV > CAC를 충족하는 과정을 구체적인 숫자로 증명했는가?' },
      { id: 'valuePricing', label: '가격이 제공 가치와 고객의 지불 의향을 반영해 설계되었는가?' },
      { id: 'economiesOfScale', label: '성장에 따른 수익성 개선을 비용 구조로 설명했는가?' },
      { id: 'revenueDiversification', label: '장기적인 수익원 다각화 로드맵을 제시했는가?' },
    ],
  },
  {
    title: '성장 및 실행 계획',
    items: [
      { id: 'acquisitionFunnel', label: '고객 획득을 측정 가능한 퍼널과 액션 플랜으로 제시했는가?' },
      { id: 'sustainableGrowth', label: '지속 가능한 성장 경로와 핵심 성장 동력을 명확히 했는가?' },
      { id: 'accountableKpis', label: '전략 목표가 담당자·기한이 분명한 OKR/KPI와 연결되었는가?' },
      { id: 'executionAndRisk', label: '실행 조직 역량과 외부 환경 리스크 관리 방안을 명시했는가?' },
    ],
  },
  {
    title: '외부 환경 분석',
    items: [
      { id: 'macroTrend', label: '핵심 거시 트렌드와 3~5년 후 변화 속에서도 성장할 이유를 설명했는가?' },
      { id: 'externalRisk', label: '규제·법률 리스크와 파트너·보완재를 식별하고 대응 계획을 마련했는가?' },
    ],
  },
];

export const RESULT_CHECKLIST_GROUPS: ChecklistGroup[] = [
  {
    title: '사실 검증',
    items: [
      { id: 'noHallucination', label: '출처 없는 인물 발언이나 지나치게 상세한 수치를 사실처럼 기술하지 않았는가?' },
      { id: 'reliableSources', label: '정보가 신뢰할 수 있는 1차 자료이며 원문의 맥락을 유지하는가?' },
      { id: 'currentData', label: '모든 데이터가 충분히 최신이며 기준 연도가 명확한가?' },
    ],
  },
  {
    title: '논리 검증',
    items: [
      { id: 'hiddenAssumptions', label: '숨겨진 가정들을 식별하고 합리성과 현실성을 검증했는가?' },
      { id: 'logicalValidity', label: '상관관계를 인과관계로 오인하거나 인지 편향에 빠지지 않았는가?' },
      { id: 'alternativeExplanations', label: '동일 데이터를 설명할 수 있는 다른 대안까지 비교했는가?' },
      { id: 'factInferencePossibility', label: '사실·추론·가능성을 구분해 주장의 신뢰 수준을 드러냈는가?' },
    ],
  },
];

export function createEmptyChecklist(groups: ChecklistGroup[]): ChecklistState {
  return Object.fromEntries(groups.flatMap((group) => group.items.map((item) => [item.id, false])));
}
