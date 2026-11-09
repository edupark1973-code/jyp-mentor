/* One-time import. The default is a dry run; --commit writes only missing source rows. */
const Excel = require('exceljs');
const crypto = require('node:crypto');
const path = require('node:path');
const { buildSync } = require('esbuild');
const compiled = buildSync({ entryPoints: ['src/lib/directory-import.ts'], bundle: true, platform: 'node', format: 'cjs', write: false }).outputFiles[0].text;
const loaded = { exports: {} };
new Function('module', 'exports', 'require', compiled)(loaded, loaded.exports, require);
const { extractSheet, sourceHeaderRow } = loaded.exports;
const project = 'jyp-mentor';
const root = `projects/${project}/databases/(default)/documents`;
const base = `https://firestore.googleapis.com/v1/${root}`;
const sources = [
  { kind: 'company', file: 'edu-import-0.xlsx', source: '스타트업리스트.xlsx' },
  { kind: 'person', file: 'edu-import-1.xlsx', source: '추천 강사 멘토풀.xlsx' },
  { kind: 'vendor', file: 'edu-import-2.xlsx', source: '외주용역업체 추천목록.xlsx' },
];
const folder = 'C:/Users/Public/Documents/ESTsoft/CreatorTemp';
const str = (value) => ({ stringValue: value });
function toDocument(entry) {
  return { name: `${root}/directory_entries/${entry.id}`, fields: {
    kind: str(entry.kind), source: str(entry.source), sheet: str(entry.sheet),
    row: { integerValue: String(entry.row) }, archived: { booleanValue: false },
    fields: { arrayValue: { values: entry.fields.map((field) => ({ mapValue: { fields: { label: str(field.label), value: str(field.value) } } })) } },
  } };
}
async function request(url, token, body) {
  const response = await fetch(url, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`Firestore 요청 실패: ${response.status} ${(await response.text()).slice(0, 400)}`);
  return response.json();
}
async function main() {
  const commit = process.argv.includes('--commit');
  const verify = process.argv.includes('--verify');
  let token = '';
  if (commit || verify) {
    const auth = require(path.join(process.env.APPDATA, 'npm/node_modules/firebase-tools/lib/auth'));
    const account = auth.getGlobalDefaultAccount();
    if (!account || account.user.email !== 'edupark1973@gmail.com') throw new Error('지정된 Firebase 관리자 계정이 필요합니다.');
    const credentials = await auth.getAccessToken(account.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform']);
    token = credentials.access_token;
    if (!token) throw new Error('Firebase 인증을 확인해 주세요.');
  }
  let total = 0;
  for (const source of sources) {
    const workbook = new Excel.Workbook();
    await workbook.xlsx.readFile(path.join(folder, source.file));
    for (const sheet of workbook.worksheets) {
      if (sheet.name === '멘토자격' || sheet.name === 'App Metadata') continue;
      const header = sourceHeaderRow(sheet.name);
      const entries = extractSheet(sheet, header, header + 1).map((entry) => ({ ...entry, kind: source.kind, source: source.source, id: crypto.createHash('sha256').update(JSON.stringify([source.kind, source.source, entry.sheet, entry.row])).digest('hex') }));
      if (entries.some((entry) => Buffer.byteLength(JSON.stringify(toDocument(entry))) > 900_000)) throw new Error(`${sheet.name}: 문서 크기 초과`);
      let inserted = 0;
      if (commit || verify) {
        for (let offset = 0; offset < entries.length; offset += 100) {
          const chunk = entries.slice(offset, offset + 100);
          const body = { documents: chunk.map((entry) => `${root}/directory_entries/${entry.id}`) };
          if (!verify) body.mask = { fieldPaths: ['kind'] };
          const existing = await request(`${base}:batchGet`, token, body);
          const found = new Set(existing.filter((item) => item.found).map((item) => item.found.name));
          const missing = chunk.filter((entry) => !found.has(`${root}/directory_entries/${entry.id}`));
          if (verify && missing.length) throw new Error(`${sheet.name}: ${missing.length}개 원본 행이 누락됐습니다.`);
          if (verify) {
            const documents = new Map(existing.filter((item) => item.found).map((item) => [item.found.name, item.found]));
            for (const entry of chunk) {
              const document = documents.get(`${root}/directory_entries/${entry.id}`);
              const fields = document.fields;
              const stored = (fields.fields.arrayValue.values || []).map((item) => ({ label: item.mapValue.fields.label.stringValue, value: item.mapValue.fields.value.stringValue }));
              if (fields.kind.stringValue !== entry.kind || fields.source.stringValue !== entry.source || fields.sheet.stringValue !== entry.sheet || Number(fields.row.integerValue) !== entry.row || JSON.stringify(stored) !== JSON.stringify(entry.fields)) throw new Error(`${sheet.name}: ${entry.row}행 저장 내용이 일치하지 않습니다.`);
            }
          }
          if (commit && missing.length) {
            await request(`${base}:commit`, token, { writes: missing.map((entry) => ({ update: toDocument(entry), currentDocument: { exists: false } })) });
            inserted += missing.length;
          }
        }
      }
      total += entries.length;
      console.log(JSON.stringify({ sheet: sheet.name, rows: entries.length, ...(commit ? { inserted } : {}), ...(verify ? { verified: entries.length } : {}) }));
    }
  }
  console.log(JSON.stringify({ mode: commit ? 'commit' : verify ? 'verify' : 'dry-run', total }));
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
