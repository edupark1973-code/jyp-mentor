import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';

const FONT = 'Malgun Gothic';
// A4(11,906 twip)에서 좌우 여백 1,134 twip을 제외한 실제 본문 폭입니다.
// 한컴오피스는 OOXML의 백분율 표 너비를 다르게 해석할 수 있어 DXA 고정값을 사용합니다.
const PAGE_CONTENT_WIDTH = 9638;

function splitTableRow(line: string) {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  const cells: string[] = [];
  let current = '';

  for (let index = 0; index < trimmed.length; index += 1) {
    const character = trimmed[index];
    if (character === '|' && trimmed[index - 1] !== '\\') {
      cells.push(current.trim());
      current = '';
    } else {
      current += character;
    }
  }

  cells.push(current.trim());
  return cells.map((cell) => cell.replace(/\\\|/g, '|'));
}

function isTableDivider(line: string) {
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function inlineRuns(value: string, options: { bold?: boolean; color?: string } = {}) {
  const runs: TextRun[] = [];
  const pattern = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let cursor = 0;

  for (const match of value.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > cursor) runs.push(new TextRun({ text: value.slice(cursor, start), font: FONT, ...options }));

    const token = match[0];
    if (token.startsWith('**') || token.startsWith('__')) {
      runs.push(new TextRun({ text: token.slice(2, -2), font: FONT, ...options, bold: true }));
    } else if (token.startsWith('`')) {
      runs.push(new TextRun({ text: token.slice(1, -1), font: FONT, color: '334155', shading: { fill: 'F1F5F9' }, ...options }));
    } else {
      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      runs.push(new TextRun({ text: link ? `${link[1]} (${link[2]})` : token, font: FONT, color: '2563EB', ...options }));
    }
    cursor = start + token.length;
  }

  if (cursor < value.length) runs.push(new TextRun({ text: value.slice(cursor), font: FONT, ...options }));
  return runs.length > 0 ? runs : [new TextRun({ text: '', font: FONT, ...options })];
}

function tableCell(text: string, header: boolean, width: number) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: header ? { type: ShadingType.CLEAR, fill: 'E2E8F0' } : undefined,
    margins: { top: 100, bottom: 100, left: 120, right: 120 },
    children: [new Paragraph({
      spacing: { after: 0 },
      children: inlineRuns(text.replace(/<br\s*\/?>/gi, '\n'), { bold: header }),
    })],
  });
}

function markdownChildren(markdown: string) {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const children: Array<Paragraph | Table> = [];

  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    const nextLine = lines[index + 1] ?? '';

    if (line.includes('|') && isTableDivider(nextLine)) {
      const headerCells = splitTableRow(line);
      const columnCount = headerCells.length;
      const columnWidth = Math.floor(PAGE_CONTENT_WIDTH / columnCount);
      const columnWidths = Array.from({ length: columnCount }, (_, columnIndex) => (
        columnIndex === columnCount - 1
          ? PAGE_CONTENT_WIDTH - (columnWidth * (columnCount - 1))
          : columnWidth
      ));
      const rows = [new TableRow({
        tableHeader: true,
        children: headerCells.map((cell, columnIndex) => tableCell(cell, true, columnWidths[columnIndex])),
      })];
      index += 2;
      while (index < lines.length && lines[index].trim() && lines[index].includes('|')) {
        const cells = splitTableRow(lines[index]);
        const normalizedCells = Array.from({ length: columnCount }, (_, columnIndex) => cells[columnIndex] ?? '');
        rows.push(new TableRow({
          children: normalizedCells.map((cell, columnIndex) => tableCell(cell, false, columnWidths[columnIndex])),
        }));
        index += 1;
      }
      children.push(new Table({
        width: { size: PAGE_CONTENT_WIDTH, type: WidthType.DXA },
        columnWidths,
        layout: TableLayoutType.FIXED,
        borders: {
          top: { style: BorderStyle.SINGLE, size: 4, color: '94A3B8' },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: '94A3B8' },
          left: { style: BorderStyle.SINGLE, size: 4, color: '94A3B8' },
          right: { style: BorderStyle.SINGLE, size: 4, color: '94A3B8' },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: 'CBD5E1' },
          insideVertical: { style: BorderStyle.SINGLE, size: 2, color: 'CBD5E1' },
        },
        rows,
      }));
      children.push(new Paragraph({ spacing: { after: 120 } }));
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const levels = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3];
      children.push(new Paragraph({
        heading: levels[heading[1].length - 1],
        spacing: { before: 240, after: 120 },
        children: inlineRuns(heading[2]),
      }));
      index += 1;
      continue;
    }

    const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
    if (unordered) {
      children.push(new Paragraph({
        bullet: { level: Math.min(Math.floor((line.length - line.trimStart().length) / 2), 2) },
        spacing: { after: 60 },
        children: inlineRuns(unordered[1]),
      }));
      index += 1;
      continue;
    }

    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (ordered) {
      children.push(new Paragraph({
        numbering: { reference: 'business-plan-numbering', level: 0 },
        spacing: { after: 60 },
        children: inlineRuns(ordered[1]),
      }));
      index += 1;
      continue;
    }

    if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
      children.push(new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1', space: 1 } },
        spacing: { before: 120, after: 120 },
      }));
      index += 1;
      continue;
    }

    if (line.startsWith('> ')) {
      children.push(new Paragraph({
        indent: { left: 360 },
        border: { left: { style: BorderStyle.SINGLE, size: 12, color: '93C5FD', space: 8 } },
        spacing: { after: 120 },
        children: inlineRuns(line.slice(2), { color: '475569' }),
      }));
      index += 1;
      continue;
    }

    if (!line.trim()) {
      children.push(new Paragraph({ spacing: { after: 60 } }));
      index += 1;
      continue;
    }

    const paragraphLines = [line.trim()];
    index += 1;
    while (
      index < lines.length
      && lines[index].trim()
      && !/^(#{1,3})\s+/.test(lines[index])
      && !/^\s*[-*+]\s+/.test(lines[index])
      && !/^\s*\d+[.)]\s+/.test(lines[index])
      && !(lines[index].includes('|') && isTableDivider(lines[index + 1] ?? ''))
    ) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }
    children.push(new Paragraph({
      spacing: { after: 120, line: 360 },
      children: inlineRuns(paragraphLines.join(' ')),
    }));
  }
  return children;
}

export async function downloadBusinessPlanDocx(markdown: string, title: string) {
  const document = new Document({
    numbering: { config: [{
      reference: 'business-plan-numbering',
      levels: [{
        level: 0,
        format: LevelFormat.DECIMAL,
        text: '%1.',
        alignment: AlignmentType.START,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } },
      }],
    }] },
    styles: { default: { document: { run: { font: FONT, size: 21 } } } },
    sections: [{
      properties: { page: { margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } } },
      children: markdownChildren(markdown),
    }],
  });

  const blob = await Packer.toBlob(document);
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement('a');
  const safeTitle = title.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').trim() || '사업계획서';
  anchor.href = url;
  anchor.download = `${safeTitle}_7단계_사업계획서.docx`;
  window.document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
