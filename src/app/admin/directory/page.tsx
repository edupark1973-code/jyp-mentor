'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, deleteDoc, doc, getDocs, setDoc, writeBatch, Timestamp } from 'firebase/firestore';
import type { Workbook } from 'exceljs';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/useAuthStore';
import { canonicalLabel, extractSheet, sourceHeaderRow, type ImportedRow } from '@/lib/directory-import';
import { companyColumns, companyVisibleColumns, isCompanyCandidate, projectCompany } from '@/lib/company-directory';

type Kind = 'company' | 'person' | 'vendor';
type Entry = ImportedRow & { id: string; kind: Kind; source: string; archived?: boolean };
const labels: Record<Kind, string> = { company: '기업 DB', person: '강사·멘토 인력풀', vendor: '외주업체 DB' };
const personColumns = ['분류', '성명', '소속', '직위', '연락처', '이메일', '주요이력'] as const;
const vendorColumns = ['대분류', '소분류', '업체명', '지역', '연락처'] as const;

function personValue(entry: Entry, column: typeof personColumns[number]) {
  const patterns: Record<typeof personColumns[number], RegExp> = {
    분류: /^분류$/,
    성명: /^(성명|이름|멘토명|강사명)$/,
    소속: /^(주 ?소속|소속|기관명|회사명)$/,
    직위: /^(직위|직책|직급)$/,
    연락처: /^(연락처|휴대전화|휴대폰|전화번호)$/,
    이메일: /^(이메일|이메일주소|email|e-mail)$/i,
    주요이력: /^(이력 ?및 ?경력(?:\(특이사항\))?|경력|주요이력|주요 ?경력|특이사항)$/,
  };
  return entry.fields.filter((field) => patterns[column].test(field.label.replace(/\s/g, ''))).map((field) => field.value).join('\n') || '—';
}

function vendorValue(entry: Entry, column: typeof vendorColumns[number]) {
  const patterns: Record<typeof vendorColumns[number], RegExp> = {
    대분류: /^(대분류|대 ?분류)$/,
    소분류: /^(소분류|소 ?분류)$/,
    업체명: /^(업체명|회사명|기업명)$/,
    지역: /^(지역|주소|소재지)$/,
    연락처: /^(연락처|전화번호|휴대전화|카톡|카카오톡|사이트 ?링크)$/,
  };
  return entry.fields.filter((field) => patterns[column].test(field.label.replace(/\s/g, ''))).map((field) => field.value).join('\n') || '—';
}

function structuredFields(kind: Kind, fields: ImportedRow['fields'], sheet: string) {
  if (kind === 'company') return projectCompany({ sheet, fields });
  const columns = kind === 'person' ? personColumns : vendorColumns;
  const values: { label: string; value: string }[] = columns.map((column) => ({ label: column, value: '' }));
  const reference: string[] = [];
  const patterns: Record<string, RegExp> = kind === 'person' ? {
    분류: /^(분류|구분|탭)$/,
    성명: /^(성명|이름|멘토명|강사명)$/, 소속: /^(주 ?소속|소속|기관명|회사명)$/, 직위: /^(직위|직책|직급)$/,
    연락처: /^(연락처|휴대전화|휴대폰|전화번호)$/, 이메일: /^(이메일|이메일주소|email|e-mail)$/i, 주요이력: /^(이력 ?및 ?경력(?:\(특이사항\))?|경력|주요이력|주요 ?경력|특이사항)$/,
  } : {
    대분류: /^(대분류|대 ?분류)$/, 소분류: /^(소분류|소 ?분류)$/, 업체명: /^(업체명|회사명|기업명)$/, 지역: /^(지역|주소|소재지)$/, 연락처: /^(연락처|연락방법|전화번호|휴대전화|휴대폰|카톡|카카오톡)$/,
  };
  for (const field of fields) {
    const label = field.label.replace(/\s/g, '');
    const index = columns.findIndex((column) => patterns[column].test(label));
    if (index >= 0) { if (field.value && !values[index].value.split('\n').includes(field.value)) values[index].value = values[index].value ? `${values[index].value}\n${field.value}` : field.value; }
    else if (field.value && field.label !== '참고') reference.push(`${field.label}: ${field.value}`);
  }
  if (kind === 'person' && !values[0].value) values[0].value = sheet;
  values.push({ label: '참고', value: reference.join('\n') });
  return values;
}

function title(entry: Entry) {
  if (entry.kind === 'company') return entry.fields.find((field) => field.label === '기업(회사)명')?.value || '(기업명 미기재)';
  const names = entry.kind === 'person' ? /^(성명|이름|멘토명|강사명)$/ : /^(기업명|회사명|회사명\(팀명\)|기업명\(팀명\)|업체명|기관명|마을기업명|조합명)$/;
  return entry.fields.find((field) => names.test(field.label.replace(/\s/g, '')))?.value || entry.fields.find((field) => !/^(번호|연번|no\.?|열 \d+)$/i.test(field.label))?.value || entry.fields[0]?.value || '(이름 없음)';
}

async function idFor(text: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}

export default function DirectoryPage() {
  const { role, loading } = useAuthStore();
  const [kind, setKind] = useState<Kind>('company');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [keyword, setKeyword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [workbook, setWorkbook] = useState<Workbook | null>(null);
  const [filename, setFilename] = useState('');
  const [sheetName, setSheetName] = useState('');
  const [header, setHeader] = useState(1);
  const [start, setStart] = useState(2);
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [shareUrl, setShareUrl] = useState('');
  const [shareFields, setShareFields] = useState('');
  const [shareDays, setShareDays] = useState(0);
  const [showArchived, setShowArchived] = useState(false);
  const [page, setPage] = useState(0);
  const [duplicatesOnly, setDuplicatesOnly] = useState(false);
  const [shares, setShares] = useState<{ id: string; active: boolean }[]>([]);
  const [vendorMajorFilters, setVendorMajorFilters] = useState<string[]>([]);
  const [vendorMinorFilters, setVendorMinorFilters] = useState<string[]>([]);

  async function reload() {
    const snapshot = await getDocs(collection(db, 'directory_entries'));
    setEntries(snapshot.docs.map((item) => ({ ...item.data(), id: item.id } as Entry)).filter((entry) => entry.kind !== 'company' || isCompanyCandidate(entry)).map((entry) => ({ ...entry, fields: structuredFields(entry.kind, entry.fields, entry.sheet) })));
    const shareSnapshot = await getDocs(collection(db, 'directory_shares'));
    setShares(shareSnapshot.docs.map((item) => ({ id: item.id, active: item.data().active === true })));
  }
  useEffect(() => { if (role === 'mentor') void reload().catch(() => setMessage('자료를 불러오지 못했습니다. 권한과 연결을 확인해 주세요.')); }, [role]);

  const duplicateNames = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of entries) {
      if (entry.kind !== kind || entry.archived) continue;
      const name = title(entry).trim().replace(/\s+/g, '').toLowerCase();
      if (name && name !== '(이름없음)' && name !== '(기업명미기재)') counts.set(name, (counts.get(name) || 0) + 1);
    }
    return new Set([...counts].filter(([, count]) => count > 1).map(([name]) => name));
  }, [entries, kind]);
  const vendorMajors = useMemo(() => [...new Set(entries.filter((entry) => entry.kind === 'vendor' && !entry.archived).map((entry) => vendorValue(entry, '대분류')).filter(Boolean))].sort(), [entries]);
  const vendorMinors = useMemo(() => [...new Set(entries.filter((entry) => entry.kind === 'vendor' && !entry.archived).map((entry) => vendorValue(entry, '소분류')).filter(Boolean))].sort(), [entries]);
  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    const result = entries.filter((entry) => entry.kind === kind && Boolean(entry.archived) === showArchived && (!duplicatesOnly || duplicateNames.has(title(entry).trim().replace(/\s+/g, '').toLowerCase())) && (kind !== 'vendor' || (!vendorMajorFilters.length || vendorMajorFilters.includes(vendorValue(entry, '대분류'))) && (!vendorMinorFilters.length || vendorMinorFilters.includes(vendorValue(entry, '소분류')))) && (!q || [entry.source, entry.sheet, ...entry.fields.flatMap((field) => [field.label, field.value])].join(' ').toLowerCase().includes(q)));
    return [...result].sort((left, right) => kind !== 'vendor' ? 0 : `${vendorValue(left, '대분류')}\u0000${vendorValue(left, '소분류')}\u0000${vendorValue(left, '업체명')}`.localeCompare(`${vendorValue(right, '대분류')}\u0000${vendorValue(right, '소분류')}\u0000${vendorValue(right, '업체명')}`, 'ko'));
  }, [entries, kind, keyword, showArchived, duplicatesOnly, duplicateNames, vendorMajorFilters, vendorMinorFilters]);
  const chosen = filtered.filter((entry) => selected.includes(entry.id));
  const availableShareFields = [...new Set(chosen.flatMap((entry) => entry.fields.map((field) => canonicalLabel(field.label))))].sort();
  const preview = useMemo(() => {
    if (!workbook || !sheetName) return [];
    try { return extractSheet(workbook.getWorksheet(sheetName)!, header, start); } catch { return []; }
  }, [workbook, sheetName, header, start]);

  async function openFile(file: File) {
    setMessage('엑셀 파일을 읽고 있습니다.');
    try {
      const Excel = await import('exceljs');
      const next = new Excel.Workbook();
      await next.xlsx.load(await file.arrayBuffer());
      const first = next.worksheets.find((sheet) => !['멘토자격', 'App Metadata'].includes(sheet.name));
      const suggested = sourceHeaderRow(first?.name || '');
      const originalName = next.getWorksheet('기업리스트') && next.getWorksheet('kict') ? '스타트업리스트.xlsx'
        : next.getWorksheet('피어멘토') && next.getWorksheet('전문 멘토') ? '추천 강사 멘토풀.xlsx'
        : next.getWorksheet('외주용역업체목록') ? '외주용역업체 추천목록.xlsx' : file.name;
      const originalKind = originalName === '스타트업리스트.xlsx' ? 'company' : originalName === '추천 강사 멘토풀.xlsx' ? 'person' : originalName === '외주용역업체 추천목록.xlsx' ? 'vendor' : null;
      if (originalKind && originalKind !== kind) { setWorkbook(null); setMessage('이 파일에 맞는 자료 종류를 먼저 선택해 주세요.'); return; }
      setWorkbook(next); setFilename(originalName); setSheetName(first?.name || ''); setHeader(suggested); setStart(suggested + 1);
      setMessage('시트와 제목 행을 확인한 뒤 가져오세요.');
    } catch { setMessage('엑셀 파일을 읽지 못했습니다. .xlsx 파일을 확인해 주세요.'); }
  }

  async function importRows() {
    if (!preview.length) return;
    setBusy(true); setMessage('가져오는 중입니다. 창을 닫지 마세요.');
    let added = 0;
    try {
      const existing = new Set(entries.map((entry) => entry.id));
      for (let offset = 0; offset < preview.length; offset += 300) {
        const batch = writeBatch(db);
        for (const row of preview.slice(offset, offset + 300)) {
          const id = await idFor(JSON.stringify([kind, filename, row.sheet, row.row]));
          if (existing.has(id)) continue;
          if (kind === 'company' && !isCompanyCandidate(row)) continue;
          batch.set(doc(db, 'directory_entries', id), { ...row, fields: structuredFields(kind, row.fields, row.sheet), kind, source: filename, archived: false });
          existing.add(id); added++;
        }
        await batch.commit();
        setMessage(`${added}개 저장 중…`);
      }
      await reload(); setMessage(`${added}개를 가져왔습니다. 같은 파일·시트·행은 건너뛰었습니다.`);
    } catch { await reload().catch(() => {}); setMessage(`가져오기 중 오류가 발생했습니다. ${added}개 처리 후 중단되었을 수 있습니다. 다시 시도하면 기존 행은 건너뜁니다.`); }
    finally { setBusy(false); }
  }

  async function exportRows() {
    const Excel = await import('exceljs');
    const out = new Excel.Workbook();
    const sheet = out.addWorksheet('자료');
    const columns: string[] = kind === 'company' ? [...companyColumns] : kind === 'person' ? [...personColumns] : kind === 'vendor' ? [...vendorColumns] : [...new Set(filtered.flatMap((entry) => entry.fields.map((field) => canonicalLabel(field.label))))];
    sheet.addRow(kind === 'company' ? columns : [...columns, '원본 시트']);
    filtered.forEach((entry) => sheet.addRow([...columns.map((column) => kind === 'person' ? personValue(entry, column as typeof personColumns[number]) : kind === 'vendor' ? vendorValue(entry, column as typeof vendorColumns[number]) : entry.fields.filter((field) => (kind === 'company' ? field.label : canonicalLabel(field.label)) === column).map((field) => field.value).join(' / ')), ...(kind === 'company' || kind === 'person' || kind === 'vendor' ? [] : [entry.sheet])]));
    const buffer = await out.xlsx.writeBuffer();
    const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    const a = document.createElement('a'); a.href = url; a.download = `${labels[kind]}.xlsx`; a.click(); URL.revokeObjectURL(url);
  }

  async function saveEdit() {
    if (!editing) return;
    if (!editing.fields.some((field) => field.value.trim())) { setMessage('내용을 입력해 주세요.'); return; }
    if (editing.kind === 'company' && !isCompanyCandidate(editing)) { setMessage('기업은 아이템·사업내용과 연락처 또는 이메일을 입력해 주세요.'); return; }
    const { id, ...data } = editing;
    await setDoc(doc(db, 'directory_entries', id), data);
    setEntries((current) => current.some((entry) => entry.id === id) ? current.map((entry) => entry.id === id ? editing : entry) : [editing, ...current]);
    setEditing(null);
  }
  async function mergeSelected() {
    if (chosen.length !== 2) { setMessage('병합할 두 항목을 선택해 주세요.'); return; }
    if (!window.confirm('선택한 두 항목의 내용을 첫 번째 항목에 합치고 두 번째 항목을 보관합니다. 같은 대상인지 확인하셨습니까?')) return;
    const [primary, secondary] = chosen;
    const batch = writeBatch(db);
    const secondarySource = `${secondary.source} / ${secondary.sheet} / ${secondary.row}행`;
    batch.update(doc(db, 'directory_entries', primary.id), { fields: [...primary.fields, { label: '병합된 원본 출처', value: secondarySource }, ...secondary.fields] });
    batch.update(doc(db, 'directory_entries', secondary.id), { archived: true, mergedInto: primary.id });
    await batch.commit();
    setEntries((current) => current.map((entry) => entry.id === primary.id ? { ...entry, fields: kind === 'company' ? projectCompany({ sheet: primary.sheet, fields: [...primary.fields, ...secondary.fields] }) : [...primary.fields, { label: '병합된 원본 출처', value: secondarySource }, ...secondary.fields] } : entry.id === secondary.id ? { ...entry, archived: true } : entry));
    setSelected([]); setShareFields(''); setMessage('병합했습니다. 두 번째 항목은 보관함에 남아 있습니다.');
  }
  async function makeShare() {
    const requested = shareFields.split(',').map((field) => field.trim()).filter(Boolean);
    if (!chosen.length || !requested.length) { setMessage('공유할 행과 표시할 항목을 선택해 주세요.'); return; }
    if (chosen.length > 100) { setMessage('한 번에 최대 100개 항목을 공유할 수 있습니다.'); return; }
    const records = chosen.map((entry) => ({ fields: entry.fields.filter((field) => requested.includes(field.label) || requested.includes(canonicalLabel(field.label))) }));
    if (new TextEncoder().encode(JSON.stringify(records)).length > 700_000) { setMessage('공유 내용이 너무 큽니다. 선택 범위를 줄여 주세요.'); return; }
    if (records.every((record) => !record.fields.length)) { setMessage('입력한 항목명과 일치하는 항목이 없습니다.'); return; }
    const id = crypto.randomUUID() + crypto.randomUUID().replaceAll('-', '');
    await setDoc(doc(db, 'directory_shares', id), { active: true, title: labels[kind], records, createdAt: Timestamp.now(), expiresAt: shareDays ? Timestamp.fromMillis(Date.now() + shareDays * 86_400_000) : null });
    setShareUrl(`${window.location.origin}/shared-directory/?id=${id}`); setShares((current) => [...current, { id, active: true }]);
  }

  if (loading) return <p className="p-8">로그인 확인 중…</p>;
  if (role !== 'mentor') return <p className="p-8">관리자만 이용할 수 있습니다.</p>;
  return <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-8">
    <header><p className="text-sm font-bold text-blue-600">자료 관리</p><h1 className="text-3xl font-black">기업·인력·업체 DB</h1><p className="mt-2 text-sm text-slate-500">원본 시트와 행을 보존하며 검색하고 관리합니다.</p></header>
    {message && <p role="status" className="rounded-xl bg-blue-50 p-4 text-sm text-blue-800">{message}</p>}
    <div className="flex flex-wrap gap-2">{(Object.keys(labels) as Kind[]).map((item) => <button key={item} onClick={() => { setKind(item); setSelected([]); setShareFields(''); setWorkbook(null); setPage(0); }} className={`rounded-xl px-4 py-2 font-bold ${kind === item ? 'bg-blue-700 text-white' : 'bg-white text-slate-700'}`}>{labels[item]}</button>)}</div>
    <section className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="font-bold">엑셀 가져오기</h2><p className="my-2 text-sm text-slate-500">.xlsx 파일의 시트를 선택하고 제목 행과 데이터 시작 행을 확인하세요. 각 시트별로 가져옵니다.</p><input key={kind} type="file" accept=".xlsx" onChange={(event) => { const file = event.target.files?.[0]; if (file) void openFile(file); }} />
      {workbook && <div className="mt-4 space-y-3"><div className="flex flex-wrap items-center gap-3"><select value={sheetName} onChange={(event) => { const name = event.target.value; const suggested = sourceHeaderRow(name); setSheetName(name); setHeader(suggested); setStart(suggested + 1); }} className="rounded border p-2">{workbook.worksheets.filter((s) => s.name !== '멘토자격' && s.name !== 'App Metadata').map((sheet) => <option key={sheet.name}>{sheet.name}</option>)}</select><label>제목 행 <input type="number" min="0" value={header} onChange={(event) => setHeader(Number(event.target.value))} className="w-20 rounded border p-2" /></label><label>데이터 시작 행 <input type="number" min="1" value={start} onChange={(event) => setStart(Number(event.target.value))} className="w-20 rounded border p-2" /></label><button disabled={busy || !preview.length || sheetName === '멘토자격' || sheetName === 'App Metadata'} onClick={() => void importRows()} className="rounded bg-blue-700 px-4 py-2 font-bold text-white disabled:opacity-50">{preview.length}행 가져오기</button></div><p className="text-xs text-slate-500">제목 행이 없으면 0을 입력합니다. 미리보기: {preview.slice(0, 2).map((row) => row.fields.map((field) => `${field.label}: ${field.value}`).join(' | ')).join(' / ')}</p></div>}
    </section>
    <section className="rounded-2xl bg-white p-5 shadow-sm"><div className="flex flex-wrap gap-3"><input value={keyword} onChange={(event) => { setKeyword(event.target.value); setPage(0); }} placeholder="이름, 지역, 분야, 출처 검색" className="min-w-56 flex-1 rounded-xl border p-3" /><button onClick={() => void exportRows()} className="rounded-xl border px-4 font-bold">검색 결과 엑셀 다운로드</button><button onClick={() => setEditing({ id: crypto.randomUUID(), kind, source: '직접 등록', sheet: '직접 등록', row: 0, fields: (kind === 'company' ? [...companyColumns] : kind === 'person' ? [...personColumns, '참고'] : [...vendorColumns, '참고']).map((label) => ({ label, value: '' })) })} className="rounded-xl bg-blue-700 px-4 py-2 font-bold text-white">직접 등록</button><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showArchived} onChange={(event) => { setShowArchived(event.target.checked); setPage(0); }} />보관함</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={duplicatesOnly} onChange={(event) => { setDuplicatesOnly(event.target.checked); setPage(0); }} />이름 중복 후보</label><button disabled={chosen.length !== 2 || showArchived} onClick={() => void mergeSelected().catch(() => setMessage('병합하지 못했습니다.'))} className="rounded-xl border px-4 py-2 text-sm font-bold disabled:opacity-40">선택 2건 병합</button></div><p className="my-3 text-sm text-slate-500">검색 결과 {filtered.length}건 · 선택 {chosen.length}건. 이름이 같더라도 다른 대상일 수 있으므로 확인 후 관리하세요.</p>
      {kind === 'vendor' && <div className="mb-4 space-y-3 rounded-xl bg-slate-50 p-3"><p className="text-sm font-bold">대분류·소분류 필터 (선택한 항목만 표시)</p><div className="flex flex-wrap gap-3">{vendorMajors.map((value) => <label key={`major-${value}`} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={vendorMajorFilters.includes(value)} onChange={(event) => setVendorMajorFilters((current) => event.target.checked ? [...current, value] : current.filter((item) => item !== value))} />{value}</label>)}</div><div className="flex flex-wrap gap-3 border-t pt-2">{vendorMinors.map((value) => <label key={`minor-${value}`} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={vendorMinorFilters.includes(value)} onChange={(event) => setVendorMinorFilters((current) => event.target.checked ? [...current, value] : current.filter((item) => item !== value))} />{value}</label>)}</div><button className="text-xs text-blue-700" onClick={() => { setVendorMajorFilters([]); setVendorMinorFilters([]); }}>필터 초기화</button></div>}
      <div className="max-h-[600px] overflow-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">선택</th>{kind === 'company' ? companyVisibleColumns.map((column) => <th key={column} className="min-w-40 p-2">{column}</th>) : kind === 'person' ? personColumns.map((column) => <th key={column} className="min-w-32 p-2">{column}</th>) : kind === 'vendor' ? vendorColumns.map((column) => <th key={column} className="min-w-32 p-2">{column}</th>) : <th>이름 / 내용</th>}<th>관리</th></tr></thead><tbody>{filtered.slice(page * 100, page * 100 + 100).map((entry) => <tr key={entry.id} className="border-t"><td className="p-2"><input type="checkbox" checked={selected.includes(entry.id)} onChange={(event) => { setSelected(event.target.checked ? [...selected, entry.id] : selected.filter((id) => id !== entry.id)); setShareFields(''); }} /></td>{kind === 'company' ? companyVisibleColumns.map((column) => <td key={column} className="min-w-40 whitespace-pre-wrap break-words p-2 align-top">{entry.fields.find((field) => field.label === column)?.value || '—'}</td>) : kind === 'person' ? personColumns.map((column) => <td key={column} className="min-w-32 whitespace-pre-wrap break-words p-2 align-top">{personValue(entry, column)}</td>) : kind === 'vendor' ? vendorColumns.map((column) => <td key={column} className="min-w-32 whitespace-pre-wrap break-words p-2 align-top">{vendorValue(entry, column)}</td>) : <td className="p-2">{title(entry)}</td>}<td><button onClick={() => setEditing(entry)} className="text-blue-700">상세·수정</button></td></tr>)}</tbody></table></div><div className="mt-3 flex items-center gap-4 text-sm"><button disabled={page === 0} onClick={() => setPage(page - 1)} className="rounded border px-3 py-1 disabled:opacity-40">이전</button><span>{page + 1} / {Math.max(1, Math.ceil(filtered.length / 100))}</span><button disabled={(page + 1) * 100 >= filtered.length} onClick={() => setPage(page + 1)} className="rounded border px-3 py-1 disabled:opacity-40">다음</button></div>
    </section>
    <section className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="font-bold">선택 항목 읽기 전용 공유</h2><p className="my-2 text-sm text-slate-500">표시할 항목을 직접 선택하세요. 선택하지 않은 연락처와 메모는 공유되지 않습니다.</p><div className="my-3 flex flex-wrap gap-3">{availableShareFields.map((field) => { const checked = shareFields.split(',').includes(field); return <label key={field} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={checked} onChange={(event) => { const current = shareFields.split(',').filter(Boolean); setShareFields((event.target.checked ? [...current, field] : current.filter((value) => value !== field)).join(',')); }} />{field}</label>; })}</div><label className="mr-3 text-sm">만료 <select value={shareDays} onChange={(event) => setShareDays(Number(event.target.value))} className="rounded border p-2"><option value={0}>직접 중지할 때까지</option><option value={7}>7일</option><option value={30}>30일</option><option value={90}>90일</option></select></label><button onClick={() => void makeShare().catch(() => setMessage('공유 링크를 만들지 못했습니다.'))} className="rounded bg-slate-900 px-4 py-2 text-white">링크 만들기</button>{shareUrl && <p className="mt-3 break-all text-sm">{shareUrl}</p>}<div className="mt-4 space-y-2">{shares.filter((share) => share.active).map((share) => <div key={share.id} className="flex items-center justify-between gap-2 text-xs"><a className="truncate text-blue-700" href={`/shared-directory/?id=${share.id}`} target="_blank" rel="noreferrer">공유 링크 열기</a><button className="text-red-700" onClick={() => void deleteDoc(doc(db, 'directory_shares', share.id)).then(() => setShares((current) => current.filter((item) => item.id !== share.id)))}>공유 중지</button></div>)}</div></section>
    {editing && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-6"><h2 className="text-xl font-bold">상세 정보</h2><p className="mb-4 text-sm text-slate-500">{editing.source} / {editing.sheet} / {editing.row}행</p>{editing.fields.map((field, index) => <label key={index} className="mb-3 block text-sm font-bold">{field.label}<textarea value={field.value} onChange={(event) => setEditing({ ...editing, fields: editing.fields.map((value, i) => i === index ? { ...value, value: event.target.value } : value) })} className="mt-1 block w-full rounded border p-2 font-normal" /></label>)}<div className="flex gap-2"><button onClick={() => void saveEdit().catch(() => setMessage('저장하지 못했습니다.'))} className="rounded bg-blue-700 px-4 py-2 text-white">저장</button><button onClick={() => { setEditing(null); }} className="rounded border px-4 py-2">닫기</button>{entries.some((entry) => entry.id === editing.id) && <button onClick={() => void setDoc(doc(db, 'directory_entries', editing.id), { archived: !editing.archived }, { merge: true }).then(() => { setEntries((current) => current.map((entry) => entry.id === editing.id ? { ...entry, archived: !editing.archived } : entry)); setEditing(null); }).catch(() => setMessage('상태를 변경하지 못했습니다.'))} className="ml-auto text-red-700">{editing.archived ? '복구' : '보관'}</button>}</div></div></div>}
  </div>;
}
