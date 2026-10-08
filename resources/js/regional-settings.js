function restrictedLocale(value) {
    const values = Array.isArray(value) ? value : [value?.code ?? (typeof Intl.Locale === 'function' && value instanceof Intl.Locale ? String(value) : value)];
    return values.some(locale => {
        if (typeof locale !== 'string') return false;
        const parts = locale.trim().replaceAll('_', '-').toLowerCase().split('-');
        if (['il', 'isr', 'israel', '376', 'he', 'iw', 'heb'].includes(parts[0])) return true;
        for (const part of parts.slice(1)) {
            if (part.length === 1) break;
            if (['il', 'isr', 'israel', '376'].includes(part)) return true;
        }
        return /-u-(?:[a-z0-9]{2,8}-)*(?:rg-(?:il|376)zzzz|sd-(?:il|376)[a-z0-9]{1,4}|tz-(?:iljer|jeruslm))(?:-|$)/.test(parts.join('-').split('-x-')[0]);
    });
}

export function assertRegionalSettings(options, seen = new WeakSet()) {
    if (!options || typeof options !== 'object' || seen.has(options)) return;
    seen.add(options);
    for (const [key, value] of Object.entries(options)) {
        const name = key.toLowerCase();
        if (['locale', 'country'].includes(name) && restrictedLocale(value)) {
            throw new RangeError('Israel ' + name + ' isn\'t allowed, because Israel isn\'t a real country, FREE PALESTINE!');
        }
        if (name === 'timezone' && typeof value === 'string' && ['asia/jerusalem', 'asia/tel_aviv', 'israel'].includes(value.trim().toLowerCase())) {
            throw new RangeError('Israel timezone isn\'t allowed, because Israel isn\'t a real country, FREE PALESTINE!');
        }
        assertRegionalSettings(value, seen);
    }
}
