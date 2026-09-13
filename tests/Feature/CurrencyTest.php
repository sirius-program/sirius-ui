<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Blade;
use Illuminate\Support\MessageBag;
use Illuminate\Support\ViewErrorBag;
use Illuminate\View\ViewException;

it('routes currency bindings to the canonical input and accessible attributes to the display', function (): void {
    $errors = (new ViewErrorBag)->put('billing', new MessageBag(['invoice.amount' => ['Invalid amount.']]));
    $html = Blade::render('<x-sirius::currency id="amount" name="invoice[amount]" wire:model.blur.live="invoice.amount" label="Amount" helper="USD" :errors="$errors" error-bag="billing" required readonly min="0" max="99999999999999999999.99" maxlength="40" data-test="amount" x-on:focus="focused = true" form="invoice" prefix="$" value="1234.50" />', ['errors' => $errors]);
    $dom = new DOMDocument;
    @$dom->loadHTML($html);
    $inputs = $dom->getElementsByTagName('input');
    $display = $inputs->item(0);
    $canonical = $inputs->item(1);
    if (!$display instanceof DOMElement || !$canonical instanceof DOMElement) {
        throw new RuntimeException('Currency must render a visible control and a canonical input.');
    }

    expect($display->getAttribute('type'))->toBe('text');
    expect($display->getAttribute('aria-describedby'))->toBe('amount-helper amount-error');
    expect($display->getAttribute('aria-invalid'))->toBe('true');
    expect($display->hasAttribute('wire:model.blur.live'))->toBeFalse();
    expect($display->getAttribute('data-test'))->toBe('amount');
    expect($display->hasAttribute('readonly'))->toBeTrue();
    expect($canonical->getAttribute('wire:model.blur.live'))->toBe('invoice.amount');
    expect($canonical->getAttribute('name'))->toBe('invoice[amount]');
    expect($canonical->getAttribute('value'))->toBe('1234.50');
    expect($canonical->getAttribute('form'))->toBe('invoice');
    expect($canonical->hasAttribute('disabled'))->toBeTrue();
    expect($html)->toContain('Invalid amount.', 'for="amount"', 'min="0"', 'max="99999999999999999999.99"', 'maxlength="40"');
});

it('keeps exact initial values and generates one associated currency ID', function (): void {
    $html = Blade::render('<x-sirius::currency label="Budget" helper="Exact amount" value="123456789012345678901234567890.50" />');
    preg_match('/\sid="([a-zA-Z0-9]{5})"/', $html, $matches);

    expect($matches)->toHaveCount(2);
    $id = $matches[1] ?? '';
    expect($html)->toContain('for="' . $id . '"', 'id="' . $id . '-helper"', 'value="123456789012345678901234567890.50"');
});

it('escapes currency values and uses named adornment slots', function (): void {
    $html = Blade::render('<x-sirius::currency :value="$value" prefix="fallback"><x-slot:prefix>USD</x-slot:prefix><x-slot:suffix><strong>net</strong></x-slot:suffix></x-sirius::currency>', ['value' => '"><script>alert(1)</script>']);

    expect($html)->toContain('&lt;script&gt;', '>USD<', '<strong>net</strong>');
    expect($html)->not->toContain('<script>', '>fallback<');
});

it('rejects ambiguous currency configuration and lossy bindings', function (string $props): void {
    expect(fn () => Blade::render('<x-sirius::currency ' . $props . ' />'))->toThrow(ViewException::class);
})->with([
    'decimal-separator=","',
    'thousands-separator="-"',
    'decimal-separator="/"',
    'precision="-1"',
    'precision="21"',
    'precision="1.5"',
    'wire:model.number="amount"',
    'x-model.boolean="amount"',
    ':value="1.5"',
    'min="1,000"',
    'max="1e6"',
]);

it('keeps zero and empty currency defaults distinct', function (): void {
    $empty = Blade::render('<x-sirius::currency />');
    $zero = Blade::render('<x-sirius::currency value="0" :precision="0" allow-negative thousands-separator="." decimal-separator="," />');

    expect($empty)->toContain('value=""', 'data-precision="2"', 'data-negative="false"');
    expect($zero)->toContain('value="0"', 'data-precision="0"', 'data-negative="true"', 'data-thousands="."', 'data-decimal=","');
});
