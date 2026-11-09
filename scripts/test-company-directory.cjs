const assert = require('node:assert/strict');
const test = require('node:test');
const { buildSync } = require('esbuild');
const compiled = buildSync({ entryPoints: ['src/lib/company-directory.ts'], bundle: true, platform: 'node', format: 'cjs', write: false }).outputFiles[0].text;
const m = { exports: {} };
new Function('module', 'exports', 'require', compiled)(m, m.exports, require);
const { projectCompany, isCompanyCandidate } = m.exports;

test('maps actual startup sheet headers and discards unrelated fields', () => {
  const fields = [
    { label: '기업/동아리명', value: '회사' }, { label: '대표자명', value: '대표' },
    { label: '사업아이템', value: '제품' }, { label: '대표전화번호', value: '010-1234-5678' },
    { label: '대표이메일', value: 'a@example.com' }, { label: '멘토명', value: '다른 정보' },
  ];
  assert.deepEqual(projectCompany({ sheet: 'kict', fields }).map((field) => field.value), ['회사', '대표', '제품', '010-1234-5678', 'a@example.com', '출처 탭: kict\n멘토명: 다른 정보']);
});

test('retains an idea without inventing a company name', () => {
  const entry = { sheet: '모두의창업', fields: [{ label: '한줄 아이디어', value: '아이디어' }, { label: '이름', value: '대표' }] };
  assert.equal(isCompanyCandidate(entry), false);
  assert.deepEqual(projectCompany(entry).map((field) => field.value), ['', '대표', '아이디어', '', '', '출처 탭: 모두의창업']);
});

test('combines different business descriptions and avoids identical duplicates', () => {
  const fields = [{ label: '주요사업', value: '제조' }, { label: '주요사업', value: '판매' }, { label: '사업내용', value: '제조' }];
  assert.equal(projectCompany({ sheet: '자료', fields })[2].value, '제조\n판매');
  assert.equal(isCompanyCandidate({ sheet: '자료', fields: [{ label: '멘토명', value: '사람' }] }), false);
  assert.equal(isCompanyCandidate({ sheet: '자료', fields: [{ label: '아이템', value: '제품' }, { label: '이메일', value: 'a@example.com' }] }), true);
  assert.equal(isCompanyCandidate({ sheet: '자료', fields: [{ label: '기업명', value: '회사' }, { label: '휴대전화', value: '010-1234-5678' }] }), false);
});
