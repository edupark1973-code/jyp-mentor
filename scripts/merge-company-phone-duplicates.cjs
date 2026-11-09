/* Groups company records by normalized phone number. Dry-run by default. */
const path = require('node:path');
const crypto = require('node:crypto');

const project = 'jyp-mentor';
const root = `projects/${project}/databases/(default)/documents`;
const collection = `${root}/directory_entries`;
const base = `https://firestore.googleapis.com/v1/${collection}`;
const commit = process.argv.includes('--commit');

function value(field, name) {
  const item = field?.fields?.[name];
  if (!item) return '';
  if ('stringValue' in item) return item.stringValue;
  if ('integerValue' in item) return item.integerValue;
  if ('booleanValue' in item) return String(item.booleanValue);
  return '';
}
function readFields(document) {
  return (document.fields?.fields?.arrayValue?.values || []).map((item) => ({
    label: value(item.mapValue, 'label'),
    value: value(item.mapValue, 'value'),
  }));
}
function fieldValue(fields, label) { return fields.find((field) => field.label === label)?.value || ''; }
function phoneTokens(text) {
  return [...new Set(text.split(/[\n,;/|]+/).map((part) => part.replace(/\D/g, '')).filter((part) => /^(010|011|016|017|018|019)\d{7,8}$/.test(part)))];
}
function contactText(fields) {
  return fields.filter((field) => /^(연락처|연락처\(개인정보보호로자발적기록만허용\)|대표전화번호|대표연락처|전화번호|휴대전화|휴대폰|핸드폰|전화)$/i.test(field.label.replace(/\s+/g, ''))).map((field) => field.value).join('\n');
}
function str(value) { return { stringValue: value }; }
function array(fields) { return { arrayValue: { values: fields.map((field) => ({ mapValue: { fields: { label: str(field.label), value: str(field.value) } } })) } }; }
async function authToken() {
  const auth = require(path.join(process.env.APPDATA, 'npm/node_modules/firebase-tools/lib/auth'));
  const account = auth.getGlobalDefaultAccount();
  if (!account || account.user.email !== 'edupark1973@gmail.com') throw new Error('Firebase 관리자 계정을 확인해 주세요.');
  return (await auth.getAccessToken(account.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform'])).access_token;
}
async function request(token, url, options = {}) {
  const response = await fetch(url, { ...options, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(options.headers || {}) } });
  if (!response.ok) throw new Error(`Firestore ${response.status}: ${(await response.text()).slice(0, 400)}`);
  return response.json();
}
async function listAll(token) {
  const documents = [];
  let pageToken = '';
  do {
    const url = new URL(base);
    url.searchParams.set('pageSize', '1000');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const page = await request(token, url);
    documents.push(...(page.documents || []));
    pageToken = page.nextPageToken || '';
  } while (pageToken);
  return documents;
}
function mergedFields(primary, duplicate) {
  const output = primary.map((field) => ({ ...field }));
  for (const field of duplicate) {
    const target = output.find((item) => item.label === field.label);
    if (!target && field.value) output.push({ ...field });
    else if (target && field.value && !target.value.split('\n').includes(field.value)) target.value = target.value ? `${target.value}\n${field.value}` : field.value;
  }
  return output;
}
async function main() {
  const token = await authToken();
  const documents = (await listAll(token)).filter((document) => value(document, 'kind') === 'company' && value(document, 'archived') !== 'true');
  if (process.argv.includes('--restore')) {
    const archived = (await listAll(token)).filter((document) => value(document, 'kind') === 'company' && value(document, 'mergedInto'));
    const writes = archived.map((document) => ({ update: { name: document.name, fields: { archived: { booleanValue: false }, mergedInto: { nullValue: 'NULL_VALUE' } } }, updateMask: { fieldPaths: ['archived', 'mergedInto'] } }));
    for (let offset = 0; offset < writes.length; offset += 300) await request(token, `${base.replace('/directory_entries', '')}:commit`, { method: 'POST', body: JSON.stringify({ writes: writes.slice(offset, offset + 300) }) });
    console.log(JSON.stringify({ mode: 'restore', restored: archived.length }));
    return;
  }
  if (process.argv.includes('--inspect')) { console.log(JSON.stringify(documents.slice(0, 1).map((document) => document), null, 2)); return; }
  const groups = new Map();
  let contactRecords = 0;
  for (const document of documents) {
    const fields = readFields(document);
    const contact = contactText(fields);
    if (contact) contactRecords++;
    for (const phone of phoneTokens(contact)) {
      const group = groups.get(phone) || [];
      group.push({ document, fields });
      groups.set(phone, group);
    }
  }
  const parent = new Map();
  const find = (name) => { if (!parent.has(name)) parent.set(name, name); const current = parent.get(name); if (current !== name) parent.set(name, find(current)); return parent.get(name); };
  const union = (a, b) => { const rootA = find(a); const rootB = find(b); if (rootA !== rootB) parent.set(rootB, rootA); };
  for (const group of groups.values()) for (let index = 1; index < group.length; index++) union(group[0].document.name, group[index].document.name);
  const components = new Map();
  for (const document of documents) { const name = document.name; const rootName = find(name); const group = components.get(rootName) || []; group.push({ document, fields: readFields(document) }); components.set(rootName, group); }
  const uniqueGroups = new Map([...components.values()].filter((group) => group.length > 1).map((group) => [group.map((item) => item.document.name).sort().join('|'), { phone: '연락처 연결 그룹', group }]));
  const writes = [];
  for (const { phone, group } of uniqueGroups.values()) {
    group.sort((a, b) => a.document.name.localeCompare(b.document.name));
    const primary = group[0];
    let fields = primary.fields;
    for (const duplicate of group.slice(1)) fields = mergedFields(fields, duplicate.fields);
    const references = group.slice(1).map((item) => `${value(item.document, 'source')} / ${value(item.document, 'sheet')} / ${value(item.document, 'row')}행`);
    const reference = fields.find((field) => field.label === '참고');
    if (reference) reference.value = [...new Set([...reference.value.split('\n'), ...references.map((text) => `병합 원본: ${text}`)])].filter(Boolean).join('\n');
    const primaryFields = { fields: { fields: array(fields), archived: { booleanValue: false } } };
    writes.push({ update: { name: primary.document.name, fields: primaryFields.fields }, updateMask: { fieldPaths: ['fields', 'archived'] } });
    for (const duplicate of group.slice(1)) writes.push({ update: { name: duplicate.document.name, fields: { archived: { booleanValue: true }, mergedInto: str(primary.document.name.split('/').pop()) } }, updateMask: { fieldPaths: ['archived', 'mergedInto'] } });
  }
  console.log(JSON.stringify({ mode: commit ? 'commit' : 'dry-run', companyRecords: documents.length, contactRecords, phoneGroups: groups.size, duplicateGroups: uniqueGroups.size, archivedRecords: writes.filter((write) => write.update.fields.archived?.booleanValue).length }));
  if (commit) for (let offset = 0; offset < writes.length; offset += 300) await request(token, `${base.replace(`/directory_entries`, '')}:commit`, { method: 'POST', body: JSON.stringify({ writes: writes.slice(offset, offset + 300) }) });
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
