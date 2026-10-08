<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Blade;
use Illuminate\View\ViewException;
use Livewire\Livewire;
use Sirius\Ui\Livewire\Chart;
use Sirius\Ui\Support\ChartOptions;
use Sirius\Ui\Support\PhoneCountry;
use Tests\Fixtures\TestCalendar;

it('excludes Israel from wildcard country choices while retaining other countries', function (): void {
    expect(PhoneCountry::resolve('*')['countries'])->not->toContain('IL')->toContain('PS', 'IN', 'US');
    expect(Blade::render('<x-sirius::phone country="*" />'))->not->toContain('value="IL"')->toContain('value="PS"');
});

it('rejects Israel country identifiers and lists before resolving a phone country', function (mixed $country): void {
    expect(fn (): array => PhoneCountry::resolve($country))->toThrow(InvalidArgumentException::class, 'Israel country');
})->with(['IL', 'il', 'ISR', 'Israel', 'he', 'iw', 'he_IL', 'en-IL', [['ID', 'IL']]]);

it('rejects Israel inherited phone countries instead of choosing another default', function (string $key, string $value): void {
    config(['sirius-ui.phone_country' => null, 'sirius-ui.locale' => null, 'app.locale' => null, 'app.fallback_locale' => null, $key => $value]);

    expect(fn (): array => PhoneCountry::resolve())->toThrow(InvalidArgumentException::class, 'Israel country');
    expect(fn (): array => PhoneCountry::resolve('*'))->toThrow(InvalidArgumentException::class, 'Israel country');
})->with([['sirius-ui.phone_country', 'IL'], ['sirius-ui.locale', 'he'], ['app.locale', 'en_IL'], ['app.fallback_locale', 'he-IL']]);

it('rejects Israel picker props and library options even when another prop overrides an option', function (string $props): void {
    expect(fn (): string => Blade::render('<x-sirius::datetime-picker ' . $props . ' />'))->toThrow(ViewException::class, 'Israel');
})->with([
    'locale="he"', 'locale="en_IL"', 'locale="iw-IL"',
    ':options="[\'locale\' => \'he\']"', 'locale="en" :options="[\'locale\' => \'he\']"',
    'timezone="Asia/Jerusalem"', 'timezone="Asia/Tel_Aviv"', 'timezone="Israel"',
]);

it('rejects Israel inherited picker settings before language fallback', function (string $key, string $value): void {
    config(['sirius-ui.locale' => null, 'sirius-ui.timezone' => null, 'app.locale' => null, 'app.fallback_locale' => null, 'app.timezone' => null, $key => $value]);

    expect(fn (): string => Blade::render('<x-sirius::datetime-picker />'))->toThrow(ViewException::class, 'Israel');
})->with([
    ['sirius-ui.locale', 'en-IL'], ['app.locale', 'he'], ['app.fallback_locale', 'iw'],
    ['sirius-ui.timezone', 'Israel'], ['app.timezone', 'Asia/Jerusalem'],
]);

it('rejects Israel calendar settings through props options and subsequent configuration', function (): void {
    foreach ([
        [['locale' => 'he'], ['locale' => 'he']],
        [['locale' => 'en', 'options' => ['locale' => 'en-IL']], ['locale' => 'en-IL']],
        [['timezone' => 'Asia/Jerusalem'], ['timeZone' => 'Asia/Jerusalem']],
        [['timezone' => 'UTC', 'options' => ['timeZone' => 'Israel']], ['timeZone' => 'Israel']],
        [['options' => ['timeZone' => 'Asia/Tel_Aviv']], ['timeZone' => 'Asia/Tel_Aviv']],
        [['options' => ['views' => ['dayGridMonth' => ['locale' => 'he']]]], ['views' => ['dayGridMonth' => ['locale' => 'he']]]],
    ] as [$props, $options]) {
        expect(fn () => (new TestCalendar)->mount(locale: $props['locale'] ?? null, timezone: $props['timezone'] ?? null, options: $props['options'] ?? []))->toThrow(InvalidArgumentException::class, 'Israel');
        $calendar = new TestCalendar;
        $calendar->mount(locale: 'en', timezone: 'UTC');
        expect(fn () => $calendar->changeOptions($options))->toThrow(InvalidArgumentException::class, 'Israel');
    }
});

it('rejects inherited Israel calendar settings', function (string $key, string $value): void {
    config(['sirius-ui.locale' => null, 'sirius-ui.timezone' => null, 'app.locale' => null, 'app.fallback_locale' => null, 'app.timezone' => null, $key => $value]);

    expect(fn () => (new TestCalendar)->mount())->toThrow(InvalidArgumentException::class, 'Israel');
})->with([['sirius-ui.locale', 'he'], ['app.fallback_locale', 'en_IL'], ['app.timezone', 'Asia/Jerusalem']]);

it('rejects Hebrew and Israel regional tags in Chart number formatting', function (string $locale): void {
    $data = ['labels' => ['Jan'], 'datasets' => [['data' => [1]]]];

    expect(fn (): array => ChartOptions::validate('bar', $data, ['locale' => $locale], null, null))->toThrow(InvalidArgumentException::class, 'Israel locale');
})->with(['he', 'HE', 'iw', 'heb', 'he_IL', 'en-IL', 'ar_il', 'en-Latn-IL', 'en-Israel', 'en-376', 'en-u-rg-ilzzzz', 'en-u-rg-376zzzz', 'en-u-sd-ilta', 'en-u-sd-376ta', 'en-u-tz-iljer']);

it('rejects Israel regional options nested in Chart extensions', function (): void {
    $data = ['labels' => ['Jan'], 'datasets' => [['data' => [1]]]];
    foreach ([
        ['scales' => ['x' => ['adapters' => ['date' => ['locale' => ['code' => 'he']]]]]],
        ['plugins' => ['formatter' => ['timeZone' => 'Asia/Jerusalem']]],
        ['plugins' => ['formatter' => ['country' => ['US', 'IL']]]],
    ] as $options) {
        expect(fn (): array => ChartOptions::validate('bar', $data, $options, null, null))->toThrow(InvalidArgumentException::class, 'Israel');
    }
});

it('rejects inherited Israel locales during Chart rendering', function (string $key): void {
    config(['sirius-ui.locale' => null, 'app.locale' => null, 'app.fallback_locale' => null, $key => 'he']);

    expect(fn () => Livewire::test(Chart::class))->toThrow(ViewException::class, 'Israel locale');
})->with(['sirius-ui.locale', 'app.locale', 'app.fallback_locale']);

it('preserves allowed explicit regional settings over unused restricted defaults', function (): void {
    config(['sirius-ui.locale' => 'he', 'sirius-ui.timezone' => 'Israel', 'sirius-ui.phone_country' => 'IL']);

    expect(PhoneCountry::resolve('PS')['initial'])->toBe('PS');
    expect(Blade::render('<x-sirius::datetime-picker locale="ar" timezone="Asia/Gaza" />'))->toContain('Asia/Gaza');
    $calendar = new TestCalendar;
    $calendar->mount(locale: 'ar', timezone: 'Asia/Hebron');
    expect($calendar->settings['timeZone'])->toBe('Asia/Hebron');
    $data = ['labels' => ['Jan'], 'datasets' => [['data' => [1]]]];
    expect(ChartOptions::validate('bar', $data, ['locale' => 'en-IN'], null, null)['options']['locale'])->toBe('en-IN');
    expect(ChartOptions::validate('bar', $data, ['locale' => 'en-x-u-rg-ilzzzz'], null, null)['options']['locale'])->toBe('en-x-u-rg-ilzzzz');
});
