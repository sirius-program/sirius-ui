import { readFileSync, writeFileSync } from 'node:fs';

writeFileSync('dist/sirius.js', ['resources/js/sirius.js', 'resources/js/currency.js']
    .map(path => readFileSync(path, 'utf8')).join('\n'));
