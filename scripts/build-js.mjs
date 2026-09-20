import { getCountries, getCountryCallingCode } from 'libphonenumber-js/max';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

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
const phone = `(() => {
const module = { exports: {} }; const exports = module.exports;
${read('node_modules/libphonenumber-js/bundle/libphonenumber-max.js')}
const phoneLibrary = module.exports;
${read('resources/js/phone.js')}
})();`;
const names = new Intl.DisplayNames(['en'], { type: 'region' });
mkdirSync('resources/data', { recursive: true });
writeFileSync('resources/data/phone-countries.json', JSON.stringify(Object.fromEntries(getCountries().map(country => [country, { code: getCountryCallingCode(country), name: names.of(country) }])), null, 2) + '\n');
writeFileSync('dist/sirius.js', [read('resources/js/sirius.js'), read('resources/js/currency.js'), datetimePicker, phone].join('\n'));
writeFileSync('dist/third-party-notices.txt', `Flatpickr 4.6.13 (MIT) — date/time picker and bundled locales\n\n${read('node_modules/flatpickr/LICENSE.md')}\n\nlibphonenumber-js 1.13.13 (MIT) and Google-derived numbering metadata (Apache-2.0)\n\n${read('node_modules/libphonenumber-js/LICENSE')}\n\n${read('node_modules/libphonenumber-js/LICENSE.Apache')}`);
