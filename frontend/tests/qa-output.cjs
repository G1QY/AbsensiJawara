const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const output = process.env.QA_OUTPUT?.trim()
  ? path.resolve(process.env.QA_OUTPUT.trim())
  : fs.mkdtempSync(path.join(os.tmpdir(), 'jawara-qa-'));
fs.mkdirSync(output, {recursive: true});
module.exports = output;
