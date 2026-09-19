<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Blade;
use Illuminate\Support\MessageBag;
use Illuminate\Support\ViewErrorBag;
use Illuminate\View\ViewException;

it('renders date types with separate canonical bindings and shared accessible validation', function (string $type, string $value, string $format): void {
    $errors = (new ViewErrorBag)->put('trip', new MessageBag(['trip.date' => ['Choose a valid date.']]));
    $html = Blade::render('<x-sirius::datetime-picker id="departure" name="trip[date]" wire:model.live="trip.date" label="Departure" helper="Local time" :type="$type" :value="$value" :errors="$errors" error-bag="trip" required readonly form="trip" data-test="date" />', ['type' => $type, 'value' => $value, 'errors' => $errors]);
    $dom = new DOMDocument;
    @$dom->loadHTML($html);
    $display = $dom->getElementsByTagName('input')->item(0);
    $hidden = $dom->getElementsByTagName('input')->item(1);
    if (!$display instanceof DOMElement || !$hidden instanceof DOMElement) {
        throw new RuntimeException('Datetime picker must render display and canonical inputs.');
    }
    expect($display->getAttribute('aria-describedby'))->toBe('departure-helper departure-error');
    expect($display->getAttribute('aria-invalid'))->toBe('true');
    expect($display->hasAttribute('wire:model.live'))->toBeFalse();
    expect($display->getAttribute('data-test'))->toBe('date');
    expect($hidden->getAttribute('wire:model.live'))->toBe('trip.date');
    expect($hidden->hasAttribute('wire:ignore'))->toBeTrue();
    expect($hidden->getAttribute('value'))->toBe($value);
    expect($hidden->getAttribute('form'))->toBe('trip');
    expect($hidden->hasAttribute('disabled'))->toBeTrue();
    $config = json_decode($display->getAttribute('data-sir-date-config'), true, flags: JSON_THROW_ON_ERROR);
    if (!is_array($config)) {
        throw new RuntimeException('Date configuration must be an object.');
    }
    expect($config['canonical'])->toBe($format);
    expect($html)->toContain('Choose a valid date.', 'for="departure"');
})->with([['date', '2028-02-29', 'Y-m-d'], ['time', '09:30', 'H:i'], ['datetime', '2028-12-31 14:30:45', 'Y-m-d H:i:S']]);

it('preserves explicit option precedence timezone and escaped invalid old input', function (): void {
    config(['app.timezone' => 'Asia/Jakarta']);
    $html = Blade::render('<x-sirius::datetime-picker :options="[\'minuteIncrement\' => 10, \'weekNumbers\' => true]" :minute-increment="15" :clearable="false" :value="$value" />', ['value' => '"><script>bad</script>']);
    expect($html)->toContain('Asia/Jakarta', 'minuteIncrement&quot;:15', 'weekNumbers&quot;:true', '&lt;script&gt;');
    expect($html)->not->toContain('data-sir-date-clear', '<script>');
    preg_match('/id="([A-Za-z0-9]{5})"/', $html, $matches);
    expect($matches)->toHaveCount(2);
});

it('rejects invalid datetime picker configuration', function (string $props): void {
    expect(fn () => Blade::render('<x-sirius::datetime-picker ' . $props . ' />'))->toThrow(ViewException::class);
})->with([
    'locale="unknown"', ':options="[\'showMonths\' => 0]"', ':options="[\'weekNumbers\' => \'true\']"',
    ':options="[\'position\' => \'sideways\']"', ':options="[\'monthSelectorType\' => \'bad\']"',
    'type="range"', 'timezone="Mars/Base"', 'week-start="7"', 'minute-increment="0"',
    'min-date="2027-02-29"', 'min-date="2029-01-01" max-date="2028-01-01"',
    'type="time" min-time="25:00"', 'type="time" min-date="2028-01-01"',
    'min-time="08:00"', 'type="time" min-time="20:00" max-time="08:00"',
    ':disabled-dates="[\'2028-02-30\']"', ':options="[\'onChange\' => \'bad\']"',
    'wire:model.number="day"', 'x-model.boolean="day"', ':value="123"', 'display-format=""',
]);

it('inherits consuming app settings at render time and allows global and per-control overrides', function (): void {
    config(['sirius-ui.locale' => null, 'sirius-ui.timezone' => null, 'app.locale' => 'id_ID', 'app.timezone' => 'Asia/Jakarta']);
    expect(Blade::render('<x-sirius::datetime-picker />'))->toContain('locale&quot;:&quot;id', 'Asia/Jakarta');

    config(['app.locale' => 'fr', 'app.timezone' => 'Europe/Paris']);
    expect(Blade::render('<x-sirius::datetime-picker />'))->toContain('locale&quot;:&quot;fr', 'Europe/Paris');

    config(['sirius-ui.locale' => 'de', 'sirius-ui.timezone' => 'Europe/Berlin']);
    expect(Blade::render('<x-sirius::datetime-picker />'))->toContain('locale&quot;:&quot;de', 'Europe/Berlin');
    expect(Blade::render('<x-sirius::datetime-picker :options="[\'locale\' => \'fr\']" />'))->toContain('locale&quot;:&quot;fr');
    expect(Blade::render('<x-sirius::datetime-picker locale="en-GB" timezone="UTC" :options="[\'locale\' => \'fr\']" />'))->toContain('locale&quot;:&quot;en', 'timezone&quot;:&quot;UTC');
});

it('resolves regional application locales to bundled picker translations', function (string $applicationLocale, string $expected): void {
    config(['sirius-ui.locale' => null, 'app.locale' => $applicationLocale]);
    expect(Blade::render('<x-sirius::datetime-picker />'))->toContain('locale&quot;:&quot;' . $expected . '&quot;');
})->with([['zh-TW', 'zh_tw'], ['pt_BR', 'pt'], ['el_GR', 'gr'], ['vi', 'vn'], ['nb_NO', 'no']]);

it('rejects invalid inherited settings instead of silently using another locale or timezone', function (string $key, mixed $value): void {
    config(['sirius-ui.locale' => null, 'sirius-ui.timezone' => null, $key => $value]);
    expect(fn () => Blade::render('<x-sirius::datetime-picker />'))->toThrow(ViewException::class);
})->with([['app.locale', 'unknown'], ['sirius-ui.locale', 12], ['sirius-ui.timezone', 'Mars/Base']]);

it('uses application fallback locale then English and UTC when defaults are null', function (): void {
    config(['sirius-ui.locale' => null, 'sirius-ui.timezone' => null, 'app.locale' => null, 'app.fallback_locale' => 'id_ID', 'app.timezone' => null]);
    expect(Blade::render('<x-sirius::datetime-picker />'))->toContain('locale&quot;:&quot;id&quot;', 'timezone&quot;:&quot;UTC&quot;');

    config(['app.fallback_locale' => null]);
    expect(Blade::render('<x-sirius::datetime-picker />'))->toContain('locale&quot;:&quot;en&quot;', 'timezone&quot;:&quot;UTC&quot;');

    config(['app.locale' => 'fr', 'app.fallback_locale' => 'id', 'app.timezone' => 'Europe/Paris']);
    expect(Blade::render('<x-sirius::datetime-picker />'))->toContain('locale&quot;:&quot;fr&quot;', 'timezone&quot;:&quot;Europe/Paris&quot;');
});

it('uses terminal defaults when application localization keys are absent', function (): void {
    config(['sirius-ui.locale' => null, 'sirius-ui.timezone' => null]);
    app('config')->offsetUnset('app.locale');
    app('config')->offsetUnset('app.fallback_locale');
    app('config')->offsetUnset('app.timezone');

    expect(Blade::render('<x-sirius::datetime-picker />'))->toContain('locale&quot;:&quot;en&quot;', 'timezone&quot;:&quot;UTC&quot;');
});

it('prioritizes explicit localization over even invalid lower priority settings for every type', function (string $type): void {
    config([
        'sirius-ui.locale'   => 'unknown', 'app.locale' => 'unknown', 'app.fallback_locale' => 'unknown',
        'sirius-ui.timezone' => 'Mars/Base', 'app.timezone' => 'Mars/Base',
    ]);

    $html = Blade::render('<x-sirius::datetime-picker :type="$type" locale="id-ID" timezone="Asia/Jakarta" :options="[\'locale\' => \'unknown\']" />', ['type' => $type]);

    expect($html)->toContain('locale&quot;:&quot;id&quot;', 'timezone&quot;:&quot;Asia/Jakarta&quot;');
})->with(['date', 'time', 'datetime']);

it('resolves locale and timezone overrides independently with null props using defaults', function (?string $locale, ?string $timezone, string $expectedLocale, string $expectedTimezone): void {
    config([
        'sirius-ui.locale'   => 'de', 'app.locale' => 'fr', 'app.fallback_locale' => 'en',
        'sirius-ui.timezone' => 'Europe/Berlin', 'app.timezone' => 'Europe/Paris',
    ]);

    $html = Blade::render('<x-sirius::datetime-picker :locale="$locale" :timezone="$timezone" />', ['locale' => $locale, 'timezone' => $timezone]);

    expect($html)->toContain('locale&quot;:&quot;' . $expectedLocale . '&quot;', 'timezone&quot;:&quot;' . $expectedTimezone . '&quot;');
})->with([
    'only locale overridden'   => ['id', null, 'id', 'Europe/Berlin'],
    'only timezone overridden' => [null, 'Asia/Jakarta', 'de', 'Asia/Jakarta'],
    'explicit null props'      => [null, null, 'de', 'Europe/Berlin'],
]);

it('rejects invalid explicit localization instead of silently replacing it with valid defaults', function (string $props): void {
    config([
        'sirius-ui.locale'   => 'de', 'app.locale' => 'fr', 'app.fallback_locale' => 'en',
        'sirius-ui.timezone' => 'Europe/Berlin', 'app.timezone' => 'Europe/Paris',
    ]);

    expect(fn () => Blade::render('<x-sirius::datetime-picker ' . $props . ' />'))->toThrow(ViewException::class);
})->with(['locale="unknown"', 'timezone="Mars/Base"']);

it('loads optional environment overrides from the publishable config without losing application fallbacks', function (?string $locale, ?string $timezone, string $expectedLocale, string $expectedTimezone): void {
    $keys = ['SIRIUS_UI_LOCALE', 'SIRIUS_UI_TIMEZONE'];
    $previous = [];
    foreach ($keys as $key) {
        $previous[$key] = $_ENV[$key] ?? null;
    }

    try {
        $_ENV['SIRIUS_UI_LOCALE'] = $locale ?? '(null)';
        $_ENV['SIRIUS_UI_TIMEZONE'] = $timezone ?? '(null)';
        $packageConfig = require __DIR__ . '/../../config/sirius-ui.php';
        config(['sirius-ui' => $packageConfig, 'app.locale' => 'fr', 'app.timezone' => 'Europe/Paris']);

        expect(config('sirius-ui.locale'))->toBe($locale);
        expect(config('sirius-ui.timezone'))->toBe($timezone);
        expect(Blade::render('<x-sirius::datetime-picker />'))->toContain('locale&quot;:&quot;' . $expectedLocale . '&quot;', 'timezone&quot;:&quot;' . $expectedTimezone . '&quot;');
        expect(Blade::render('<x-sirius::datetime-picker locale="de" timezone="Europe/Berlin" />'))->toContain('locale&quot;:&quot;de&quot;', 'timezone&quot;:&quot;Europe/Berlin&quot;');
    } finally {
        foreach ($previous as $key => $value) {
            if ($value === null) {
                unset($_ENV[$key]);
            } else {
                $_ENV[$key] = $value;
            }
        }
    }
})->with([
    'environment overrides'    => ['id', 'Asia/Jakarta', 'id', 'Asia/Jakarta'],
    'null inherits app config' => [null, null, 'fr', 'Europe/Paris'],
]);

it('defaults clearable to the inverse of required while honoring explicit overrides', function (string $props, bool $clearable): void {
    $html = Blade::render('<x-sirius::datetime-picker ' . $props . ' />');

    if ($clearable) {
        expect($html)->toContain('data-sir-date-clear');
    } else {
        expect($html)->not->toContain('data-sir-date-clear');
    }
})->with([
    'optional by default'                    => ['', true],
    'required attribute'                     => ['required', false],
    'required true'                          => [':required="true"', false],
    'required false'                         => [':required="false"', true],
    'required with explicit clearable true'  => ['required :clearable="true"', true],
    'required with explicit clearable false' => ['required :clearable="false"', false],
    'optional with explicit clearable true'  => [':required="false" :clearable="true"', true],
    'optional with explicit clearable false' => [':required="false" :clearable="false"', false],
]);
