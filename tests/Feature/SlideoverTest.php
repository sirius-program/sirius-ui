<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Blade;
use Illuminate\View\ViewException;

it('renders all edges with protected identifiers and the shared dialog lifecycle', function (string $side): void {
    $html = Blade::render('<x-sirius::slideover id="order" :side="$side" header="Order" body="Details" footer="Actions" open data-side="wrong" data-sir-slideover="wrong" data-open="wrong" wire:key="order-panel" />', ['side' => $side]);
    expect($html)->toContain('<dialog id="order"', 'sir-slideover--' . $side, 'data-side="' . $side . '"', 'data-sir-dialog', 'data-open="true"', 'id="order-header"', 'id="order-body"', 'id="order-footer"', 'wire:key="order-panel"');
    expect($html)->not->toContain('data-side="wrong"', 'data-open="wrong"', 'data-sir-slideover="wrong"');
})->with(['top', 'right', 'bottom', 'left']);

it('forwards named slots and classes without changing section IDs', function (): void {
    $html = Blade::render('<x-sirius::slideover id="order" header="Ignored" body="Ignored" footer="Ignored" header-class="heading" body-class="content" footer-class="actions"><x-slot:header id="wrong" class="custom"><h2>Order</h2></x-slot:header><p>Details</p><x-slot:footer class="extra"><button data-sir-dialog-close>Done</button></x-slot:footer></x-sirius::slideover>');
    expect($html)->toContain('<h2>Order</h2>', '<p>Details</p>', 'heading', 'content', 'actions', 'custom', 'extra', 'id="order-header"');
    expect($html)->not->toContain('Ignored', 'id="wrong"');
});

it('uses right by default and generates an ID while preserving accessible names and dismissal options', function (): void {
    $html = Blade::render('<x-sirius::slideover aria-label="Order" :closable="false" :close-on-escape="false" :close-on-backdrop="false" initial-focus="#done">Details</x-sirius::slideover>');
    expect($html)->toMatch('/<dialog id="[a-zA-Z0-9]{5}"/')->toContain('data-side="right"', 'aria-label="Order"', 'data-close-on-escape="false"', 'data-close-on-backdrop="false"', 'data-initial-focus="#done"');
    expect($html)->not->toContain('data-sir-dialog-close');
});

it('escapes slideover text sections', function (): void {
    $html = Blade::render('<x-sirius::slideover :header="$text" :body="$text" :footer="$text" />', ['text' => '<script>bad</script>']);
    expect(substr_count($html, '&lt;script&gt;bad&lt;/script&gt;'))->toBe(3);
    expect($html)->not->toContain('<script>bad');
});

it('rejects invalid edges and shared dialog contracts', function (string $template): void {
    expect(fn (): string => Blade::render($template))->toThrow(ViewException::class);
})->with([
    'side'       => '<x-sirius::slideover side="middle" header="Order" />',
    'array side' => '<x-sirius::slideover :side="[]" header="Order" />',
    'name'       => '<x-sirius::slideover />',
    'ID'         => '<x-sirius::slideover id="bad id" header="Order" />',
    'section'    => '<x-sirius::slideover :header="[]" />',
    'size'       => '<x-sirius::slideover size="bad" header="Order" />',
    'state'      => '<x-sirius::slideover open="false" header="Order" />',
]);
