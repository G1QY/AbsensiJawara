import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read = name => readFile(new URL(name, import.meta.url), 'utf8');
const workflow = await read('../src/pages/crewEvent/EventWorkflow.tsx');
const camera = await read('../src/components/attendance/CameraPhotoUpload.tsx');
test('workflow uses camera evidence and removes paper entry', () => {
  assert.match(camera, /CameraCapture/);
  assert.match(camera, /Preview/);
  assert.doesNotMatch(camera, /type="file"/);
  assert.doesNotMatch(workflow, /StepKertas|tes_print_jumlah|kertas_waste/);
  assert.match(workflow, /TOTAL_STEPS = 15/);
});
test('report includes before, after and attendance photos', () => {
  for (const key of ['check_in_photo_url','check_out_photo_url','tes_print_before_photo','tes_print_after_photo','setup_ready_photo','event_finished_photo','addPhotoPages']) assert.ok(workflow.includes(key));
});
