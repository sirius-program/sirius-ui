<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Blade;
use Illuminate\View\ViewException;
use Livewire\Features\SupportLockedProperties\CannotUpdateLockedPropertyException;
use Livewire\Livewire;
use Sirius\Ui\Livewire\Chart;
use Sirius\Ui\Support\ChartOptions;

it('renders a namespaced Chart with native data options and accessible content', function (): void {
    $html = Blade::render('<livewire:sirius::chart id="sales" :data="$data" label="Sales & revenue" description="Monthly totals" :height="280" :options="$options" />', [
        'data'    => ['labels' => ['Jan', 'Feb'], 'datasets' => [['label' => 'Revenue', 'data' => [120, null], 'borderWidth' => 3]]],
        'options' => ['plugins' => ['legend' => ['position' => 'bottom']], 'maintainAspectRatio' => true],
    ]);
    $dom = new DOMDocument;
    @$dom->loadHTML($html);
    $root = $dom->getElementById('sales');
    expect($root)->not->toBeNull();
    if ($root === null) {
        throw new RuntimeException('Chart root was not rendered.');
    }
    $payload = json_decode($root->getAttribute('data-chart-payload'), true, flags: JSON_THROW_ON_ERROR);
    expect(data_get($payload, 'data.datasets.0'))->toBe(['label' => 'Revenue', 'data' => [120, null], 'borderWidth' => 3])
        ->and(data_get($payload, 'options.plugins.legend.position'))->toBe('bottom')
        ->and(data_get($payload, 'options.maintainAspectRatio'))->toBeFalse()
        ->and(data_get($payload, 'height'))->toBe(280)
        ->and($root->getAttribute('aria-label'))->toBe('Sales & revenue');
    expect($html)->toContain('Monthly totals', 'role="img"', 'wire:ignore');
});

it('accepts native controllers mixed datasets object points and maps', function (string $type): void {
    $data = ['labels' => [['Jan', '2028']], 'datasets' => [
        ['type' => 'line', 'data' => [['x' => '2028-01-01', 'y' => 20], null]],
        ['data' => ['Jan' => 15, 'Feb' => 25]],
    ]];
    $payload = ChartOptions::validate($type, $data, ['parsing' => false, 'scales' => ['x' => ['type' => 'time']]], null, null);
    expect($payload['type'])->toBe($type)->and($payload['data'])->toBe($data)
        ->and(data_get($payload, 'options.parsing'))->toBeFalse()->and(data_get($payload, 'options.scales.x.type'))->toBe('time');
})->with(['bar', 'line', 'pie', 'doughnut', 'radar', 'polarArea', 'scatter', 'bubble', 'customController']);

it('prioritizes explicit native locale and preserves serializable options over defaults', function (): void {
    config(['sirius-ui.locale' => 'id_ID', 'app.locale' => 'fr', 'app.fallback_locale' => 'de']);
    $resolve = fn (): array => ChartOptions::validate('bar', ['datasets' => []], [], null, null)['options'];
    expect($resolve()['locale'])->toBe('id-ID');
    config(['sirius-ui.locale' => null]);
    expect($resolve()['locale'])->toBe('fr');
    config(['app.locale' => null]);
    expect($resolve()['locale'])->toBe('de');
    config(['app.fallback_locale' => null]);
    expect($resolve()['locale'])->toBe('en');
    expect(ChartOptions::validate('bar', ['datasets' => []], ['locale' => 'ja-JP', 'animation' => false, 'responsive' => false, 'maintainAspectRatio' => true], null, null)['options'])
        ->toMatchArray(['locale' => 'ja-JP', 'animation' => false, 'responsive' => false, 'maintainAspectRatio' => true]);
});

it('rejects malformed data dimensions types and non JSON configuration', function (string $case): void {
    [$type, $data, $options, $width, $height] = match ($case) {
        'type'             => ['bad type', ['datasets' => []], [], null, null],
        'missing datasets' => ['bar', [], [], null, null],
        'dataset list'     => ['bar', ['datasets' => ['first' => []]], [], null, null],
        'dataset data'     => ['bar', ['datasets' => [['data' => 'bad']]], [], null, null],
        'labels'           => ['bar', ['datasets' => [], 'labels' => 'bad'], [], null, null],
        'dataset type'     => ['bar', ['datasets' => [['type' => 2]]], [], null, null],
        'width'            => ['bar', ['datasets' => []], [], 0, null],
        'height'           => ['bar', ['datasets' => []], [], null, -1],
        'closure'          => ['bar', ['datasets' => []], ['onClick' => static fn (): null => null], null, null],
        'finite numbers'   => ['bar', ['datasets' => []], ['ratio' => INF], null, null],
        'prototype keys'   => ['bar', ['datasets' => []], ['plugins' => ['constructor' => []]], null, null],
        default            => throw new LogicException('Unknown invalid configuration case.'),
    };
    expect(fn (): array => ChartOptions::validate($type, $data, $options, $width, $height))->toThrow(InvalidArgumentException::class);
})->with([
    'type', 'missing datasets', 'dataset list', 'dataset data', 'labels', 'dataset type', 'width', 'height', 'closure', 'finite numbers', 'prototype keys',
]);

it('escapes labels descriptions and data without executing JavaScript strings', function (): void {
    $label = '<script>alert(1)</script>';
    $data = ['labels' => ['"><img src=x onerror=alert(2)>'], 'datasets' => [['data' => [10]]]];
    Livewire::test(Chart::class, ['label' => $label, 'description' => $label, 'data' => $data])
        ->assertSee($label)->assertDontSee('<script>alert(1)</script>', false);
    expect(data_get(ChartOptions::validate('bar', $data, ['plugins' => ['custom' => ['text' => '() => alert(3)']]], null, null), 'options.plugins.custom.text'))
        ->toBe('() => alert(3)');
});

it('keeps chart identity locked and supplies a generated ID and translated empty loading text', function (): void {
    $test = Livewire::test(Chart::class, ['loading' => true]);
    expect($test->get('chartId'))->toMatch('/^[a-zA-Z0-9]{5}$/');
    $test->assertSee('No chart data.')->assertSee('Loading chart…')->assertSee('aria-busy="true"', false);
    expect(fn () => $test->set('chartId', 'changed'))->toThrow(CannotUpdateLockedPropertyException::class);
});

it('rejects unsafe IDs and empty accessible names', function (array $props): void {
    expect(fn () => Livewire::test(Chart::class, $props))->toThrow(ViewException::class, 'Chart requires');
})->with([[['id' => 'bad id']], [['label' => '']]]);

it('passes published component translations to the JavaScript widget', function (): void {
    config(['app.locale' => 'id']);
    app('translator')->addLines(['sirius-ui.chart.label' => 'Grafik', 'sirius-ui.chart.empty' => 'Belum ada data.'], 'id', 'sirius');
    app()->setLocale('id');
    Livewire::test(Chart::class)->assertSee('aria-label="Grafik"', false)->assertSee('Belum ada data.')
        ->assertSee('&quot;retry&quot;:&quot;Retry&quot;', false);
});
