import type { CellValue, Worksheet } from 'exceljs';

/** Values are kept as text, including formula results and hyperlink destinations. */
export function cellText(value: CellValue): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== 'object') return String(value).trim();
  if ('richText' in value) return value.richText.map((part) => part.text).join('').trim();
  if ('hyperlink' in value) return [value.text, value.hyperlink].filter(Boolean).join(' ').trim();
  if ('result' in value) return cellText(value.result ?? null);
  if ('text' in value) return String(value.text).trim();
  if ('error' in value) return String(value.error);
  return '';
}

export type ImportedRow = { sheet: string; row: number; fields: { label: string; value: string }[] };

/** Search and export can group common aliases without changing the original label. */
export function canonicalLabel(label: string): string {
  const key = label.replace(/\s/g, '').toLowerCase();
  if (/^(기업명|기업명\(팀명\)|회사명|회사명\(팀명\)|업체명|기관명|마을기업명|조합명)$/.test(key)) return '기업·업체명';
  if (/^(성명|이름|멘토명|강사명)$/.test(key)) return '성명';
  if (/^(대표|대표명|대표자|대표자명)$/.test(key)) return '대표자';
  if (/^(연락처|대표전화번호|전화번호|휴대전화|휴대폰)$/.test(key)) return '연락처';
  if (/^(이메일|email|e-mail)$/.test(key)) return '이메일';
  if (/^(지역|주소|소재지)$/.test(key)) return '지역·주소';
  if (/^(업종|사업분야|분야|전문분야)$/.test(key)) return '분야';
  return label;
}

/** Header and data rows are explicit because many source sheets have title rows. */
export function extractSheet(sheet: Worksheet, headerRow: number, firstDataRow: number): ImportedRow[] {
  if (!Number.isInteger(headerRow) || headerRow < 0 || !Number.isInteger(firstDataRow) || firstDataRow <= headerRow) throw new Error('제목 행과 데이터 시작 행을 확인해 주세요.');
  const width = sheet.columnCount;
  const headings = Array.from({ length: width }, (_, i) => (headerRow ? cellText(sheet.getRow(headerRow).getCell(i + 1).value) : '') || `열 ${i + 1}`);
  const rows: ImportedRow[] = [];
  for (let row = firstDataRow; row <= sheet.rowCount; row++) {
    const fields = headings.map((label, i) => ({ label, value: cellText(sheet.getRow(row).getCell(i + 1).value) })).filter((field) => field.value);
    if (fields.length) rows.push({ sheet: sheet.name, row, fields });
  }
  return rows;
}

/** Known source sheets with nonstandard title rows. Zero means no header. */
export function sourceHeaderRow(sheetName: string): number {
  const special: Record<string, number> = {
    'kict전담멘티': 0, 'kict': 2, '마을기업': 3, '협동조합': 2,
    '협동조합설립현황': 2, '사회적협동조합': 2, '일반협동조합': 3,
    '사회적협동조합연합회': 2, '일반협동조합연합회': 2,
    '과학기술부 대전지역': 3, '통합-과학기술-일반': 3,
    '모두의창업': 3, '외주용역업체목록': 2,
  };
  return special[sheetName] ?? 1;
}
