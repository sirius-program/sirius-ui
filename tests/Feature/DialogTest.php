<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Blade;
use Illuminate\View\ViewException;

it('renders escaped dialog sections with an accessible header and protected lifecycle attributes', function (): void {
    $html = Blade::render('<x-sirius::dialog id="invoice" :header="$text" :body="$text" :footer="$text" open data-sir-dialog="wrong" data-open="wrong" data-closing="true" tabindex="0" role="menu" class="custom" />', ['text' => '<script>bad</script>']);

    expect($html)->toContain('<dialog id="invoice"', 'aria-labelledby="invoice-header"', 'id="invoice-header"', 'id="invoice-body"', 'id="invoice-footer"', 'data-open="true"', 'custom', 'type="button"', 'aria-label="Close"');
    expect(substr_count($html, '&lt;script&gt;bad&lt;/script&gt;'))->toBe(3);
    expect($html)->not->toContain('<script>bad', 'data-open="wrong"', 'data-closing="true"', 'tabindex="0"', 'role="menu"', ' open ');
});

it('prioritizes dialog slots while merging styles and preserving section IDs', function (): void {
    $html = Blade::render('<x-sirius::dialog id="invoice" header="Ignored" body="Ignored" footer="Ignored" header-class="heading" body-class="content" footer-class="actions"><x-slot:header id="wrong" class="custom"><h2>Invoice</h2></x-slot:header><p>Amount due</p><x-slot:footer id="wrong-footer" class="extra"><button>Pay</button></x-slot:footer></x-sirius::dialog>');

    expect($html)->toContain('<h2>Invoice</h2>', '<p>Amount due</p>', '<button>Pay</button>', 'heading', 'content', 'actions', 'custom', 'extra', 'id="invoice-header"', 'id="invoice-footer"');
    expect($html)->not->toContain('Ignored', 'id="wrong"', 'id="wrong-footer"');
});

it('omits empty optional sections and supports an explicit accessible name', function (): void {
    $html = Blade::render('<x-sirius::dialog id="notice" header="Ignored" aria-label="Notice" :closable="false"><x-slot:header> </x-slot:header> Body only</x-sirius::dialog>');

    expect($html)->toContain('aria-label="Notice"', 'id="notice-body"', 'Body only', 'data-open="false"', 'data-close-on-escape="true"', 'data-close-on-backdrop="true"');
    expect($html)->not->toContain('id="notice-header"', 'id="notice-footer"', 'data-sir-dialog-close', 'Ignored');
});

it('generates five character dialog IDs and resolves consumer translations', function (): void {
    app('translator')->addLines(['sirius-ui.dialog.close' => 'Tutup'], 'en', 'sirius');

    $html = Blade::render('<x-sirius::dialog header="Notice" size="lg" initial-focus="#confirm" :close-on-escape="false" :close-on-backdrop="false">Message</x-sirius::dialog>');

    expect($html)->toMatch('/<dialog id="[a-zA-Z0-9]{5}"/');
    expect($html)->toContain('aria-label="Tutup"', 'sir-dialog--lg', 'data-initial-focus="#confirm"', 'data-close-on-escape="false"', 'data-close-on-backdrop="false"');
});

it('rejects invalid dialog contracts', function (string $template): void {
    expect(fn (): string => Blade::render($template))->toThrow(ViewException::class);
})->with([
    'missing name'    => '<x-sirius::dialog />',
    'empty name'      => '<x-sirius::dialog aria-label=" " />',
    'invalid ID'      => '<x-sirius::dialog id="bad id" header="Notice" />',
    'empty ID'        => '<x-sirius::dialog id="" header="Notice" />',
    'invalid section' => '<x-sirius::dialog :header="[]" />',
    'invalid size'    => '<x-sirius::dialog header="Notice" size="bad" />',
    'string open'     => '<x-sirius::dialog header="Notice" open="false" />',
    'string closable' => '<x-sirius::dialog header="Notice" closable="false" />',
    'string Escape'   => '<x-sirius::dialog header="Notice" close-on-escape="false" />',
    'string backdrop' => '<x-sirius::dialog header="Notice" close-on-backdrop="false" />',
    'invalid focus'   => '<x-sirius::dialog header="Notice" :initial-focus="[]" />',
    'empty focus'     => '<x-sirius::dialog header="Notice" initial-focus=" " />',
]);
