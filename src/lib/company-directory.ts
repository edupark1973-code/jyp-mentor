export type CompanyField = { label: string; value: string };
export type CompanyRecord = { sheet: string; fields: CompanyField[] };

const keys = ['기업(회사)명', '대표명', '아이템명(주요사업내용)', '연락처(핸드폰)', '이메일주소', '참고'] as const;
export const companyColumns = keys;

function fieldKind(label: string): typeof keys[number] | null {
  const key = label.replace(/\s+/g, '').toLowerCase();
  if (/^(기업\(회사\)명|기업명|기업명\(팀명\)|회사명|회사명\(팀명\)|기업\/동아리명|기관명|마을기업명|마을기업명\(법인명\)|협동조합명|조합명)$/.test(key)) return keys[0];
  if (/^(대표명|대표|대표자|대표자명)$/.test(key)) return keys[1];
  if (/^(아이템명\(주요사업내용\)|아이템명및아이템개요|주요사업소개|아이템|사업분야\(아이템\)|사업명|사업아이템|사업소개|사업내용|생산품및서비스|주요사업|한줄아이디어)$/.test(key)) return keys[2];
  if (/^(연락처\(핸드폰\)|연락처|연락처\(개인정보보호로자발적기록만허용\)|대표전화번호|대표연락처|전화번호|휴대전화|휴대폰|핸드폰|전화)$/.test(key)) return keys[3];
  if (/^(이메일주소|대표이메일|이메일|email|e-mail)$/.test(key)) return keys[4];
  if (key === '참고') return keys[5];
  return null;
}

export function projectCompany(record: CompanyRecord): CompanyField[] {
  const values = new Map<string, string[]>();
  const extra: string[] = [];
  for (const field of record.fields) {
    const key = record.sheet === '모두의창업' && field.label.replace(/\s+/g, '') === '이름' ? keys[1] : fieldKind(field.label);
    const value = field.value.trim();
    if (!value) continue;
    if (!key) { extra.push(`${field.label}: ${value}`); continue; }
    const items = values.get(key) ?? [];
    if (!items.includes(value)) items.push(value);
    values.set(key, items);
  }
  const reference = values.get(keys[5]) ?? [];
  if (record.sheet && record.sheet !== '직접 등록' && !reference.some((text) => text.includes('출처 탭:'))) reference.unshift(`출처 탭: ${record.sheet}`);
  if (extra.length) reference.push(...extra);
  values.set(keys[5], reference);
  return keys.map((label) => ({ label, value: (values.get(label) ?? []).join('\n') }));
}

export function isCompanyCandidate(record: CompanyRecord): boolean {
  const fields = projectCompany(record);
  const present = (value: string) => Boolean(value.trim() && !/^(없음|미입력|해당없음|미정|n\/a|na|[-—–.]+)$/i.test(value.trim()));
  return present(fields[2].value) && (present(fields[3].value) || present(fields[4].value));
}
