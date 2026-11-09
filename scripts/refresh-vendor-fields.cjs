const Excel = require('exceljs');
const path = require('node:path');
const root = 'projects/jyp-mentor/databases/(default)/documents';
const collection = `${root}/directory_entries`;
const base = `https://firestore.googleapis.com/v1/${collection}`;
function str(value) { return { stringValue: value }; }
function readValue(field, key) { const item = field?.fields?.[key]; return item?.stringValue || ''; }
function readFields(document) { return (document.fields?.fields?.arrayValue?.values || []).map((item) => ({ label: readValue(item.mapValue, 'label'), value: readValue(item.mapValue, 'value') })); }
function field(fields, names) { return fields.find((item) => names.includes(item.label.replace(/\s+/g, '')))?.value || ''; }
function normalized(value) { return value.trim().replace(/\s+/g, '').toLowerCase(); }
async function authToken() { const auth = require(path.join(process.env.APPDATA, 'npm/node_modules/firebase-tools/lib/auth')); const account = auth.getGlobalDefaultAccount(); if (!account || account.user.email !== 'edupark1973@gmail.com') throw new Error('Firebase 관리자 계정을 확인해 주세요.'); return (await auth.getAccessToken(account.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform'])).access_token; }
async function request(token, url, options = {}) { const response = await fetch(url, { ...options, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(options.headers || {}) } }); if (!response.ok) throw new Error(`Firestore ${response.status}: ${(await response.text()).slice(0, 400)}`); return response.json(); }
async function listAll(token) { const output = []; let pageToken = ''; do { const url = new URL(base); url.searchParams.set('pageSize', '1000'); if (pageToken) url.searchParams.set('pageToken', pageToken); const page = await request(token, url); output.push(...(page.documents || [])); pageToken = page.nextPageToken || ''; } while (pageToken); return output; }
async function main() {
  const commit = process.argv.includes('--commit');
  const workbook = new Excel.Workbook(); await workbook.xlsx.readFile('C:/Users/Public/Documents/ESTsoft/CreatorTemp/edu-vendors-refresh.xlsx');
  const sheet = workbook.getWorksheet('외주용역업체목록'); if (!sheet) throw new Error('외주용역업체목록 시트를 찾지 못했습니다.');
  const headers = []; sheet.getRow(2).eachCell((cell, col) => { headers[col - 1] = String(cell.text).trim(); });
  const rows = [];
  for (let row = 3; row <= sheet.rowCount; row++) { const values = headers.map((header, col) => ({ label: header || `열 ${col + 1}`, value: String(sheet.getRow(row).getCell(col + 1).text || '').trim() })).filter((item) => item.value); if (values.length) rows.push({ row, fields: values }); }
  const token = await authToken(); const documents = (await listAll(token)).filter((document) => readValue(document, 'kind') === 'vendor' && readValue(document, 'archived') !== 'true');
  const byKey = new Map(); for (const document of documents) { const fields = readFields(document); const key = [field(fields, ['업체명', '회사명', '기업명']), field(fields, ['소분류']), field(fields, ['지역', '주소', '소재지'])].map(normalized).join('|'); if (key !== '||') byKey.set(key, { document, fields }); }
  const writes = []; let matched = 0; let unmatched = 0;
  for (const source of rows) {
    const category = field(source.fields, ['대분류']); const subcategory = field(source.fields, ['소분류']); const name = field(source.fields, ['업체명']); const region = field(source.fields, ['지역']); const contact = field(source.fields, ['연락방법']);
    const key = [name, subcategory, region].map(normalized).join('|'); const target = byKey.get(key);
    if (!target) { unmatched++; continue; }
    const next = target.fields.map((item) => ({ ...item }));
    const set = (label, value) => { const item = next.find((field) => field.label === label); if (item) item.value = value; else next.push({ label, value }); };
    set('대분류', category); set('소분류', subcategory); set('업체명', name); set('지역', region); set('연락처', contact);
    const kept = next.filter((item) => !['연락방법'].includes(item.label));
    const document = target.document;
    writes.push({ update: { name: document.name, fields: { fields: { arrayValue: { values: kept.map((item) => ({ mapValue: { fields: { label: str(item.label), value: str(item.value) } } })) } } } }, updateMask: { fieldPaths: ['fields'] } }); matched++;
  }
  console.log(JSON.stringify({ mode: commit ? 'commit' : 'dry-run', sourceRows: rows.length, activeVendorRecords: documents.length, matched, unmatched }));
  if (commit) for (let offset = 0; offset < writes.length; offset += 300) await request(token, `${base.replace('/directory_entries', '')}:commit`, { method: 'POST', body: JSON.stringify({ writes: writes.slice(offset, offset + 300) }) });
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
