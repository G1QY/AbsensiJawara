import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
const module=new vm.SourceTextModule(stripTypeScriptTypes(await readFile(new URL('../src/pages/admin/payrollData.ts',import.meta.url),'utf8')));await module.link(()=>{throw Error('Unexpected import')});await module.evaluate();
test('dashboard month labels cross year boundaries',()=>{assert.deepEqual([...module.namespace.monthKeys('2026-02',3)],['2025-12','2026-01','2026-02']);});
// Payroll amounts are now verified in backend/tests/payroll-persisted.test.cjs.
