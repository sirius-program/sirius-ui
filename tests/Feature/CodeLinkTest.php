<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Blade;
use Illuminate\View\ViewException;

it('renders escaped code and links in every supported tone', function (string $variant): void {
    foreach (['code', 'link'] as $name) {
        $html = Blade::render('<x-sirius::' . $name . ' :variant="$variant">{{ $text }}</x-sirius::' . $name . '>', ['variant' => $variant, 'text' => '<script>unsafe</script>']);
        expect($html)->toContain('sir-' . $name, 'sir-tone--' . $variant, '&lt;script&gt;unsafe&lt;/script&gt;');
        expect($html)->not->toContain('<script>unsafe');
    }
})->with(['primary', 'info', 'secondary', 'success', 'danger', 'warning']);

it('preserves block source whitespace and escapes it while overriding the slot', function (): void {
    $source = "\n\t<main title=\"project\">\n    & details\n</main>\n\n";
    $html = Blade::render('<pre><x-sirius::code block :text="$source">Ignored slot</x-sirius::code></pre>', ['source' => $source]);
    preg_match('~<code[^>]*>(.*?)</code>~s', $html, $match);

    expect($match[1] ?? null)->toBe(e($source));
    expect($html)->toContain('sir-code--block');
    expect($html)->not->toContain('sir-tone--', 'Ignored slot', '<main');
    expect(Blade::render('<x-sirius::code :text="\'\'">Ignored</x-sirius::code>'))->not->toContain('Ignored');
});

it('preserves authored token markup and native attributes without adding a highlighter', function (): void {
    $code = Blade::render('<x-sirius::code id="token" class="custom" data-example="code" aria-label="Source" x-on:click="ready = true"><span data-token>const</span> name</x-sirius::code>');
    expect($code)->toContain('<code ', 'sir-tone--info', 'custom', 'id="token"', 'aria-label="Source"', 'data-example="code"', 'x-on:click="ready = true"', '<span data-token>const</span> name');

    $link = Blade::render('<x-sirius::link href="/brief?a=1&amp;b=2" target="_blank" rel="noopener noreferrer" download="brief.pdf" class="custom" data-example="link" aria-label="Brief" wire:navigate wire:click="open" x-on:focus="ready = true">Brief</x-sirius::link>');
    expect($link)->toContain('<a ', 'sir-tone--primary', 'custom', 'target="_blank"', 'rel="noopener noreferrer"', 'download="brief.pdf"', 'data-example="link"', 'aria-label="Brief"', 'wire:navigate', 'wire:click="open"', 'x-on:focus="ready = true"');
    expect($link)->not->toContain('<button', 'role="button"');
});

it('accepts ordinary navigation destinations', function (string $href): void {
    $html = Blade::render('<x-sirius::link :href="$href">Details</x-sirius::link>', ['href' => $href]);
    expect($html)->toContain('href="' . e($href) . '"');
})->with(['/projects', '../projects', 'projects/42', '#details', '?page=2', 'https://example.com/?a=1&b=2', 'http://example.com', 'mailto:team@example.com', 'tel:+628123456789']);

it('rejects executable schemes and URL control characters', function (mixed $href): void {
    expect(fn (): string => Blade::render('<x-sirius::link :href="$href">Details</x-sirius::link>', ['href' => $href]))->toThrow(ViewException::class);
})->with(['javascript:alert(1)', ' JAVASCRIPT:alert(1)', 'data:text/html,<script>bad</script>', 'vbscript:bad', 'ftp://example.com', "/projects\n", "https://example.com/\x7f", false, [['href']]]);

it('rejects unsupported presentation props', function (string $source): void {
    expect(fn (): string => Blade::render($source))->toThrow(ViewException::class);
})->with([
    '<x-sirius::code variant="ghost">Bad</x-sirius::code>',
    '<x-sirius::code block="false">Bad</x-sirius::code>',
    '<x-sirius::code :text="[]" />',
    '<x-sirius::link variant="outline">Bad</x-sirius::link>',
]);

it('renders with a custom Blade namespace and stable internal aliases', function (): void {
    Blade::anonymousComponentPath(__DIR__ . '/../../resources/views/components', 'custom');
    $html = Blade::render('<x-custom::code>invoice.id</x-custom::code><x-custom::link href="#invoice">Invoice</x-custom::link><x-sirius-internal-code text="native" /><x-sirius-internal-link href="/projects">Projects</x-sirius-internal-link>');
    expect(substr_count($html, '<code '))->toBe(2);
    expect(substr_count($html, '<a '))->toBe(2);
    expect($html)->toContain('href="#invoice"', 'href="/projects"', 'invoice.id', 'native');
});
