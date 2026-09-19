import { readFileSync, writeFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const vendor = `(function () { const module = { exports: {} }; const exports = module.exports;
${read('node_modules/flatpickr/dist/flatpickr.min.js')}
return module.exports; })()`;
const locales = `(function () { const module = { exports: {} }; const exports = module.exports;
${read('node_modules/flatpickr/dist/l10n/index.js')}
return module.exports.default; })()`;
const datetimePicker = `(() => {
if (window[Symbol.for('sirius.ui.datetime-picker')]) return;
window[Symbol.for('sirius.ui.datetime-picker')] = true;
const flatpickr = ${vendor};
const locales = ${locales};
${read('resources/js/datetime-picker.js')}
})();`;
writeFileSync('dist/sirius.js', [read('resources/js/sirius.js'), read('resources/js/currency.js'), datetimePicker].join('\n'));
writeFileSync('dist/third-party-notices.txt', `Flatpickr 4.6.13 (MIT) — date/time picker and bundled locales\n\n${read('node_modules/flatpickr/LICENSE.md')}`);
