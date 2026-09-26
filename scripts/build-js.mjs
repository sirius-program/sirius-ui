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
const select = `(() => { const module = { exports: {} }; const exports = module.exports;
${read('node_modules/tom-select/dist/js/tom-select.complete.min.js')}
const TomSelect = module.exports;
${read('resources/js/select.js')}
})();`;
const names = new Intl.DisplayNames(['en'], { type: 'region' });
const uploadVendor = path => `(function () { const module = { exports: {} }; const exports = module.exports; ${read(path)}; return module.exports; })()`;
const fileUpload = `(() => {
const FilePond = ${uploadVendor('node_modules/filepond/dist/filepond.min.js')};
const validateType = ${uploadVendor('node_modules/filepond-plugin-file-validate-type/dist/filepond-plugin-file-validate-type.min.js')};
const validateSize = ${uploadVendor('node_modules/filepond-plugin-file-validate-size/dist/filepond-plugin-file-validate-size.min.js')};
const imagePreview = ${uploadVendor('node_modules/filepond-plugin-image-preview/dist/filepond-plugin-image-preview.min.js')};
const filePoster = ${uploadVendor('node_modules/filepond-plugin-file-poster/dist/filepond-plugin-file-poster.min.js')};
${read('resources/js/file-upload-pdf.js')}
${read('resources/js/file-upload.js')}
})();`;
mkdirSync('resources/data', { recursive: true });
writeFileSync('resources/data/phone-countries.json', JSON.stringify(Object.fromEntries(getCountries().map(country => [country, { code: getCountryCallingCode(country), name: names.of(country) }])), null, 2) + '\n');
writeFileSync('dist/sirius.js', [read('resources/js/sirius.js'), read('resources/js/currency.js'), datetimePicker, phone, select, fileUpload].join('\n'));
writeFileSync('dist/third-party-notices.txt', `Flatpickr 4.6.13 (MIT) — date/time picker and bundled locales\n\n${read('node_modules/flatpickr/LICENSE.md')}\n\nlibphonenumber-js 1.13.13 (MIT) and Google-derived numbering metadata (Apache-2.0)\n\n${read('node_modules/libphonenumber-js/LICENSE')}\n\n${read('node_modules/libphonenumber-js/LICENSE.Apache')}\n\nTom Select 2.6.2 (Apache-2.0)\n${read('node_modules/tom-select/LICENSE')}\n\nSifter (Apache-2.0)\n${read('node_modules/@orchidjs/sifter/README.md').split('## License')[1]}\n\nUnicode Variants (Apache-2.0)\n${read('node_modules/@orchidjs/unicode-variants/LICENSE')}`);

for (const [name, version] of [['filepond', '4.32.12'], ['filepond-plugin-file-validate-type', '1.2.9'], ['filepond-plugin-file-validate-size', '2.2.8'], ['filepond-plugin-image-preview', '4.6.12'], ['filepond-plugin-file-poster', '2.5.2']]) {
    writeFileSync('dist/third-party-notices.txt', read('dist/third-party-notices.txt') + `\n\n${name} ${version} (MIT)\n${read(`node_modules/${name}/LICENSE`)}`);
}
