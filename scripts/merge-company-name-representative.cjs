const path = require('node:path');
const { buildSync } = require('esbuild');
const compiled = buildSync({ entryPoints: ['src/lib/company-directory.ts'], bundle: true, platform: 'node', format: 'cjs', write: false }).outputFiles[0].text;
const loaded = { exports: {} };
new Function('module', 'exports', 'require', compiled)(loaded, loaded.exports, require);
const { projectCompany, isCompanyCandidate } = loaded.exports;
const root = 'projects/jyp-mentor/databases/(default)/documents';
const base = `https://firestore.googleapis.com/v1/${root}`;
const commit = process.argv.includes('--commit');
const str = (value) => ({ stringValue: value });
const get = (doc, key) => doc.fields?.[key]?.stringValue || '';
const readFields = (doc) => (doc.fields?.fields?.arrayValue?.values || []).map((item) => ({ label: item.mapValue.fields.label.stringValue, value: item.mapValue.fields.value.stringValue }));
const array = (fields) => ({ arrayValue: { values: fields.map(({ label, value }) => ({ mapValue: { fields: { label: str(label), value: str(value) } } })) } });
async function main() {
  const auth = require(path.join(process.env.APPDATA, 'npm/node_modules/firebase-tools/lib/auth'));
  const account = auth.getGlobalDefaultAccount();
  if (!account || account.user.email !== 'edupark1973@gmail.com') throw new Error('Firebase 관리자 계정을 확인하세요.');
  const token = (await auth.getAccessToken(account.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform'])).access_token;
  async function request(url, options = {}) {
    const response = await fetch(url, { ...options, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' } });
    if (!response.ok) throw new Error(`Firestore ${response.status}: ${(await response.text()).slice(0, 400)}`);
    return response.json();
  }
  const documents = []; let pageToken = '';
  do { const url = new URL(`${base}/directory_entries`); url.searchParams.set('pageSize', '1000'); if (pageToken) url.searchParams.set('pageToken', pageToken); const page = await request(url); documents.push(...(page.documents || [])); pageToken = page.nextPageToken || ''; } while (pageToken);
  if (process.argv.includes('--purge-merged')) {
    const merged = documents.filter((doc) => get(doc, 'kind') === 'company' && Boolean(get(doc, 'mergedInto')));
    console.log(JSON.stringify({ mode: commit ? 'purge-merged-commit' : 'purge-merged-dry-run', count: merged.length }));
    if (commit) for (let offset = 0; offset < merged.length; offset += 300) await request(`${base}:commit`, { method: 'POST', body: JSON.stringify({ writes: merged.slice(offset, offset + 300).map((doc) => ({ delete: doc.name, currentDocument: { updateTime: doc.updateTime } })) }) });
    return;
  }
  const groups = new Map();
  for (const doc of documents) {
    if (get(doc, 'kind') !== 'company' || doc.fields?.archived?.booleanValue === true) continue;
    const record = { sheet: get(doc, 'sheet'), fields: readFields(doc) };
    if (!isCompanyCandidate(record)) continue;
    const fields = projectCompany(record);
    const normalize = (s) => s.trim().replace(/\s+/g, '').toLowerCase();
    const company = normalize(fields[0].value);
    if (!company || /[\n\r]/.test(company) || /^(없음|미기재|미상|미정|해당없음|예비창업자|예비|n\/a|na|-+)$/.test(company)) continue;
    const key = company;
    const group = groups.get(key) || []; group.push({ doc, fields }); groups.set(key, group);
  }
  const duplicates = [...groups.values()].filter((group) => group.length > 1);
  let merged = 0;
  console.log(JSON.stringify({ mode: commit ? 'commit' : 'dry-run', groups: duplicates.length, recordsToArchive: duplicates.reduce((n, g) => n + g.length - 1, 0) }));
  if (!commit) return;
  for (const group of duplicates) {
    group.sort((a, b) => a.doc.name.localeCompare(b.doc.name));
    const primary = group[0]; const fields = primary.fields.map((f) => ({ ...f }));
    const reference = fields.find((f) => f.label === '참고');
    const lines = [];
    for (const item of group.slice(1)) {
      lines.push(`병합 원본: ${get(item.doc, 'source')} / ${get(item.doc, 'sheet')} / ${item.doc.fields.row?.integerValue || ''}행`);
      for (const field of item.fields) if (field.value && field.label !== '기업(회사)명' && (field.label === '참고' || !fields.some((f) => f.label === field.label && f.value === field.value))) lines.push(`${field.label}: ${field.value}`);
    }
    reference.value = [reference.value, ...lines].filter(Boolean).join('\n');
    const writes = [{ update: { name: primary.doc.name, fields: { fields: array(fields) } }, updateMask: { fieldPaths: ['fields'] }, currentDocument: { updateTime: primary.doc.updateTime } }];
    for (const item of group.slice(1)) writes.push({ update: { name: item.doc.name, fields: { archived: { booleanValue: true }, mergedInto: str(primary.doc.name.split('/').pop()) } }, updateMask: { fieldPaths: ['archived', 'mergedInto'] }, currentDocument: { updateTime: item.doc.updateTime } });
    await request(`${base}:commit`, { method: 'POST', body: JSON.stringify({ writes }) });
    merged += group.length - 1;
  }
  console.log(JSON.stringify({ completed: true, groups: duplicates.length, archived: merged }));
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
