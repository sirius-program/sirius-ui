<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Blade;
use Illuminate\Support\MessageBag;
use Illuminate\Support\ViewErrorBag;
use Sirius\Ui\Support\SliderOptions;

it('renders one shared label and error with ordered native range fields and one array binding', function (): void {
    $errors = (new ViewErrorBag)->put('default', new MessageBag(['price' => ['Choose a price range.']]));
    $html = Blade::render('<x-sirius::slider id="price" name="price" label="Price" helper="Per night" required range :value="[20, 80]" :min="[0, 10]" :max="[60, 100]" :step="[1, 5]" wire:model.live="price" :errors="$errors" form="booking" />', ['errors' => $errors]);

    expect(substr_count($html, 'Choose a price range.'))->toBe(1);
    expect(substr_count($html, 'wire:model.live="price"'))->toBe(1);
    expect(substr_count($html, 'name="price[]"'))->toBe(2);
    expect($html)->toContain('id="price"', 'id="price-upper"', 'aria-describedby="price-helper price-error"', 'form="booking"', 'Lower value', 'Upper value');
});

it('supports defaults decimals equal values and different handle grids', function (): void {
    expect(SliderOptions::resolve(false, 0, 100, 1, null)['value'])->toBe([0.0]);
    expect(SliderOptions::resolve(true, [0.1, 0.2], [1, 2], [0.1, 0.2], [0.3, 0.6])['value'])->toBe([0.3, 0.6]);
    expect(SliderOptions::resolve(true, [0, 10], [40, 50], [2, 5], [20, 20])['value'])->toBe([20.0, 20.0]);
    expect(SliderOptions::resolve(false, 5, 5, 1, 5)['value'])->toBe([5.0]);
    $html = Blade::render('<x-sirius::slider name="amount" label="Amount" />');
    expect($html)->toMatch('/id="[A-Za-z0-9]{5}"/');
});

it('rejects malformed or impossible slider contracts instead of normalizing them silently', function (bool $range, mixed $min, mixed $max, mixed $step, mixed $value): void {
    expect(fn (): array => SliderOptions::resolve($range, $min, $max, $step, $value))->toThrow(InvalidArgumentException::class);
})->with([
    'scalar range limits'  => [true, 0, [100, 100], [1, 1], [20, 80]],
    'scalar range max'     => [true, [0, 0], 100, [1, 1], [20, 80]],
    'scalar range step'    => [true, [0, 0], [100, 100], 1, [20, 80]],
    'missing range value'  => [true, [0, 0], [100, 100], [1, 1], null],
    'wrong count'          => [true, [0, 0], [100, 100], [1, 1], [20]],
    'associative values'   => [true, [0, 0], [100, 100], [1, 1], ['a' => 20, 'b' => 80]],
    'crossing'             => [true, [0, 0], [100, 100], [1, 1], [80, 20]],
    'impossible pair'      => [true, [70, 0], [100, 60], [1, 1], [70, 60]],
    'off grid'             => [false, 1, 10, 2, 4],
    'beyond max'           => [false, 0, 10, 1, 11],
    'reversed bounds'      => [false, 10, 0, 1, 5],
    'zero step'            => [false, 0, 100, 0, 1],
    'negative step'        => [false, 0, 100, -1, 1],
    'infinity'             => [false, 0, INF, 1, 1],
    'unrepresentable grid' => [false, 0, 100, 1e-20, 0],
    'boolean'              => [false, 0, 100, 1, true],
    'scalar array'         => [false, 0, 100, 1, [20, 80]],
]);

it('uses consumer slider translations and preserves disabled readonly and custom attributes', function (): void {
    app('translator')->addLines(['sirius-ui.slider.lower' => 'Minimum pilihan'], 'id', 'sirius');
    app()->setLocale('id');
    $html = Blade::render('<x-sirius::slider range :value="[20, 80]" :min="[0, 0]" :max="[100, 100]" :step="[1, 5]" readonly disabled data-booking="true" />');
    expect($html)->toContain('Minimum pilihan', 'readonly="readonly"', 'disabled="disabled"', 'data-booking="true"');
});
