const assert = require('node:assert/strict');
const test = require('node:test');
const { buildSync } = require('esbuild');
const Excel = require('exceljs');

const compiled = buildSync({ entryPoints: ['src/lib/directory-import.ts'], bundle: true, platform: 'node', format: 'cjs', write: false }).outputFiles[0].text;
const moduleObject = { exports: {} };
new Function('module', 'exports', 'require', compiled)(moduleObject, moduleObject.exports, require);
const { extractSheet, sourceHeaderRow, canonicalLabel } = moduleObject.exports;

test('preserves empty and duplicate column labels and source row', () => {
  const sheet = new Excel.Workbook().addWorksheet('자료');
  sheet.addRow(['이름', '', '이름']);
  sheet.addRow(['가', '추가', '나']);
  assert.deepEqual(extractSheet(sheet, 1, 2), [{ sheet: '자료', row: 2, fields: [{ label: '이름', value: '가' }, { label: '열 2', value: '추가' }, { label: '이름', value: '나' }] }]);
});

test('groups common labels without discarding original fields', () => {
  assert.equal(canonicalLabel('기업 명'), '기업·업체명');
  assert.equal(canonicalLabel('대표명'), '대표자');
  assert.equal(canonicalLabel('특별 기록'), '특별 기록');
});

test('headerless data includes the first row', () => {
  const sheet = new Excel.Workbook().addWorksheet('기록');
  sheet.addRow(['첫 행', '기록']);
  assert.equal(extractSheet(sheet, 0, 1)[0].fields[0].value, '첫 행');
});

test('known sheets use the investigated header position', () => {
  assert.equal(sourceHeaderRow('멘토자격'), 1);
  assert.equal(sourceHeaderRow('kict전담멘티'), 0);
  assert.equal(sourceHeaderRow('모두의창업'), 3);
  assert.equal(sourceHeaderRow('외주용역업체목록'), 2);
});
