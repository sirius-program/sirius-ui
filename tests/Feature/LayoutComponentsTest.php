<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Blade;
use Illuminate\View\ViewException;

it('renders escaped card shorthands with connected section IDs', function (): void {
    $html = Blade::render('<x-sirius::card id="invoice" :header="$text" :body="$text" :footer="$text" class="custom" data-record="42" />', ['text' => '<script>bad</script>']);
    expect($html)->toContain('id="invoice"', 'id="invoice-header"', 'id="invoice-body"', 'id="invoice-footer"', 'custom', 'data-record="42"');
    expect(substr_count($html, '&lt;script&gt;bad&lt;/script&gt;'))->toBe(3);
    expect($html)->not->toContain('<script>bad');
});

it('prioritizes card slots and preserves section identity while merging styling', function (): void {
    $html = Blade::render('<x-sirius::card id="invoice" header="Ignored header" body="Ignored body" footer="Ignored footer" header-class="heading" body-class="content" footer-class="actions"><x-slot:header class="custom-header" id="wrong"><h2>Invoice</h2></x-slot:header><p>Amount due</p><x-slot:footer class="custom-footer" id="wrong-footer"><button>Pay</button></x-slot:footer></x-sirius::card>');
    expect($html)->toContain('<h2>Invoice</h2>', '<p>Amount due</p>', '<button>Pay</button>', 'heading', 'custom-header', 'content', 'actions', 'custom-footer', 'id="invoice-header"', 'id="invoice-footer"');
    expect($html)->not->toContain('Ignored', 'id="wrong"', 'id="wrong-footer"');
});

it('omits empty optional card sections including explicitly empty override slots', function (): void {
    $html = Blade::render('<x-sirius::card id="minimal" header="Ignored"><x-slot:header> </x-slot:header> Body only</x-sirius::card>');
    expect($html)->toContain('id="minimal-body"', 'Body only');
    expect($html)->not->toContain('id="minimal-header"', 'id="minimal-footer"', 'Ignored');
});

it('generates five character IDs for layout components', function (string $component): void {
    $html = Blade::render('<x-sirius::' . $component . ' ' . ($component === 'accordion' ? 'trigger="Details"' : 'header="Title" footer="Footer"') . '>Body</x-sirius::' . $component . '>');
    preg_match('/<(?:div|details) id="([a-zA-Z0-9]{5})"/', $html, $matches);
    expect($matches)->toHaveCount(2);
    $id = $matches[1] ?? '';
    expect($html)->toContain('id="' . $id . ($component === 'card' ? '-body' : '-content') . '"');
})->with(['card', 'accordion']);

it('renders native disclosure state and protected trigger associations', function (): void {
    $html = Blade::render('<x-sirius::accordion id="details" open transition trigger="Ignored" trigger-class="heading" content-class="content" x-on:toggle="changed = true"><x-slot:trigger id="wrong" aria-controls="wrong" class="custom">Shipping details</x-slot:trigger><a href="/tracking">Track parcel</a></x-sirius::accordion>');
    expect($html)->toContain('<details', ' open ', 'data-transition="true"', 'id="details-trigger"', 'aria-controls="details-content"', 'id="details-content"', 'Shipping details', 'heading', 'custom', 'content', 'x-on:toggle="changed = true"');
    expect($html)->not->toContain('Ignored', 'id="wrong"', 'aria-controls="wrong"');
    $closed = Blade::render('<x-sirius::accordion trigger="Details">Content</x-sirius::accordion>');
    expect($closed)->toContain('data-transition="false"');
    expect($closed)->not->toContain(' open ', 'aria-expanded=');
});

it('rejects invalid layout IDs missing triggers and non boolean disclosure options', function (string $template): void {
    expect(fn (): string => Blade::render($template))->toThrow(ViewException::class);
})->with([
    '<x-sirius::card id="bad id" />', '<x-sirius::card id="" />',
    '<x-sirius::card :header="[]" />', '<x-sirius::accordion :trigger="[]" />',
    '<x-sirius::accordion />', '<x-sirius::accordion trigger=" " />',
    '<x-sirius::accordion id="bad id" trigger="Details" />',
    '<x-sirius::accordion trigger="Details" open="false" />',
    '<x-sirius::accordion trigger="Details" transition="false" />',
]);

it('preserves native accordion group names and independent item IDs', function (): void {
    $html = Blade::render('<x-sirius::accordion id="payment" name="order-help" trigger="Payment" open>Pay by card</x-sirius::accordion><x-sirius::accordion id="delivery" name="order-help" trigger="Delivery">Track your parcel</x-sirius::accordion>');

    expect(substr_count($html, 'name="order-help"'))->toBe(2);
    expect(substr_count($html, ' open '))->toBe(1);
    expect($html)->toContain('id="payment-trigger"', 'aria-controls="payment-content"', 'id="delivery-trigger"', 'aria-controls="delivery-content"');
});
