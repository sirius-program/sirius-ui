<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Blade;
use Illuminate\Support\Facades\Lang;
use Illuminate\View\ViewException;
use Sirius\Ui\Support\SelectOptions;

it('normalizes option IDs and values without losing zero', function (): void {
    expect(SelectOptions::normalize([['value' => 0, 'label' => 'Pickup']]))->toBe([['value' => '0', 'label' => 'Pickup', 'disabled' => false, 'group' => '']]);
    expect(SelectOptions::values(0, false))->toBe(['0']);
    expect(SelectOptions::values(['0', 0, 'a'], true))->toBe(['0', 'a']);
    expect(SelectOptions::values(null, false))->toBe([]);
    expect(SelectOptions::values([], true))->toBe([]);
});

it('renders named native selections with escaped labels and shared accessibility', function (): void {
    $html = Blade::render('<x-sirius::select id="topics" name="topics" multiple :options="$options" :value="[0]" label="Topics" helper="Choose topics" required disabled data-example />', ['options' => [['value' => 0, 'label' => '<script>alert(1)</script>', 'group' => 'Group'], ['value' => 'x', 'label' => 'Locked', 'disabled' => true]]]);

    expect($html)->toContain('name="topics[]"', 'value="0"', 'selected', 'multiple', 'disabled', 'aria-describedby="topics-helper"', '&lt;script&gt;', '<optgroup label="Group">');
    expect($html)->not->toContain('<script>');
});

it('retains unknown selected IDs for remote label resolution', function (): void {
    $html = Blade::render('<x-sirius::select name="venue" value="bali" search-url="/options" wire:model.live="venue" />');

    expect($html)->toContain('<option value="bali" selected>bali</option>', 'data-select-model', 'wire:model.live="venue"');
});

it('rejects invalid select configuration', function (string $props): void {
    expect(fn () => Blade::render('<x-sirius::select ' . $props . ' />'))->toThrow(ViewException::class);
})->with([
    ':options="[0]"', ':options="[[\'value\' => \'\', \'label\' => \'Empty\']]"',
    ':options="[[\'value\' => 0, \'label\' => \'A\'], [\'value\' => \'0\', \'label\' => \'B\']]"',
    ':value="[]"', 'multiple value="one"', ':debounce="-1"', ':min-search-length="101"',
    ':max-items="0" multiple', ':max-items="2"', 'wire:model.number="value"',
    'search-url="/options" :searchable="false"',
]);

it('passes translated select messages and renders a label status target', function (): void {
    app()->setLocale('id');
    Lang::addLines(['sirius-ui.select' => ['placeholder' => 'Pilih opsi', 'clear' => 'Hapus', 'retry' => 'Coba lagi']], 'id', 'sirius');

    $html = Blade::render('<x-sirius::select id="venue" label="Venue" search-url="/options" />');

    expect($html)->toContain('Pilih opsi', 'Hapus', 'Coba lagi', 'id="venue-label-status"', 'data-sir-label-status');
});

it('renders escaped reusable label status without adding it to the control label', function (): void {
    $html = Blade::render('<x-sirius::label for="example" :status="$status" status-id="progress">Example</x-sirius::label>', ['status' => '<loading>']);

    expect($html)->toContain('for="example"', 'role="status"', 'id="progress"', '&lt;loading&gt;');
    $label = substr($html, 0, strpos($html, '</label>') ?: 0);
    expect($label)->not->toContain('role="status"', '&lt;loading&gt;');
});
