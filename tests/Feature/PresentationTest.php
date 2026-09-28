<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Blade;
use Illuminate\View\ViewException;

it('renders semantic variants across presentation components', function (string $variant): void {
    foreach (['button', 'badge', 'message'] as $component) {
        $html = Blade::render('<x-sirius::' . $component . ' :variant="$variant" class="custom" data-demo="yes">{{ $text }}</x-sirius::' . $component . '>', ['variant' => $variant, 'text' => '<script>unsafe</script>']);
        expect($html)->toContain('sir-tone--' . $variant, 'custom', 'data-demo="yes"', '&lt;script&gt;unsafe&lt;/script&gt;');
        expect($html)->not->toContain('<script>unsafe');
    }
})->with(['primary', 'info', 'success', 'danger', 'warning', 'secondary', 'ghost', 'outline']);

it('separates link appearance from element semantics and defaults to a non submitting button', function (): void {
    expect(Blade::render('<x-sirius::button variant="link">Details</x-sirius::button>'))->toContain('<button', 'type="button"', 'sir-tone--link');
    $anchor = Blade::render('<x-sirius::button as="a" href="/projects">Projects</x-sirius::button>');
    expect($anchor)->toContain('<a ', 'href="/projects"');
    expect($anchor)->not->toContain('type=');
    expect(Blade::render('<x-sirius::button type="submit" name="intent" value="save" wire:click="save" x-on:focus="ready = true">Save</x-sirius::button>'))->toContain('type="submit"', 'name="intent"', 'value="save"', 'wire:click="save"', 'x-on:focus="ready = true"');
});

it('locks loading or disabled buttons and removes navigation from disabled anchors', function (string $state): void {
    $html = Blade::render('<x-sirius::button ' . $state . ' icon="heroicon-o-check">Save</x-sirius::button>');
    expect($html)->toContain('disabled', 'aria-disabled="true"', 'aria-busy="' . ($state === 'loading' ? 'true' : 'false') . '"');
    $anchor = Blade::render('<x-sirius::button as="a" href="/private" tabindex="0" ' . $state . '>Download</x-sirius::button>');
    expect($anchor)->toContain('aria-disabled="true"', 'tabindex="-1"', 'role="link"');
    expect($anchor)->not->toContain('href=', 'tabindex="0"');
    if ($state === 'loading') {
        expect($html)->toContain('sir-spinner');
    }
})->with(['loading', 'disabled']);

it('renders decorative and named icons with escaped accessible labels', function (): void {
    expect(Blade::render('<x-sirius::icon name="heroicon-o-check" />'))->toContain('<svg', 'aria-hidden="true"', 'focusable="false"');
    $html = Blade::render('<x-sirius::icon name="heroicon-o-check" :label="$label" size="lg" class="custom" />', ['label' => '"><script>bad</script>']);
    expect($html)->toContain('role="img"', 'aria-label="&quot;&gt;&lt;script&gt;bad&lt;/script&gt;"', 'sir-icon--lg', 'custom');
    expect($html)->not->toContain('aria-hidden', '<script>');
    expect(Blade::render('<x-sirius::button icon="heroicon-o-check" aria-label="Approve" />'))->toContain('aria-label="Approve"', '<svg');
});

it('groups ordinary buttons without adding selection semantics', function (): void {
    $html = Blade::render('<x-sirius::button-group label="Pagination"><x-sirius::button>Previous</x-sirius::button><x-sirius::button>Next</x-sirius::button></x-sirius::button-group>');
    expect($html)->toContain('role="group"', 'aria-label="Pagination"', 'Previous', 'Next');
    expect($html)->not->toContain('aria-pressed', 'tablist');
});

it('supports message announcements generated IDs reset keys and translated dismissal', function (): void {
    app('translator')->addLines(['sirius-ui.message.dismiss' => 'Close notice'], 'en', 'sirius');
    $html = Blade::render('<x-sirius::message dismissible icon="heroicon-o-check" reset-key="2">Saved</x-sirius::message>');
    preg_match('/<div id="([a-zA-Z0-9]{5})"/', $html, $matches);
    expect($matches)->toHaveCount(2);
    expect($html)->toContain('role="status"', 'aria-atomic="true"', 'data-reset-key="2"', 'aria-controls="' . ($matches[1] ?? '') . '"', 'aria-label="Close notice"');
    $danger = Blade::render('<x-sirius::message id="failure" variant="danger">Failed</x-sirius::message>');
    expect($danger)->toContain('id="failure"', 'role="alert"');
    expect($danger)->not->toContain('data-sir-message-dismiss');
    expect(Blade::render('<x-sirius::message role="note">Details</x-sirius::message>'))->toContain('role="note"');
});

it('rejects invalid presentation configuration and unnamed icon actions', function (string $source): void {
    expect(fn (): string => Blade::render($source))->toThrow(ViewException::class);
})->with([
    '<x-sirius::button as="script">Bad</x-sirius::button>',
    '<x-sirius::button variant="unknown">Bad</x-sirius::button>',
    '<x-sirius::button size="xl">Bad</x-sirius::button>',
    '<x-sirius::button icon="heroicon-o-check" />',
    '<x-sirius::badge variant="link">Bad</x-sirius::badge>',
    '<x-sirius::message variant="link">Bad</x-sirius::message>',
    '<x-sirius::message id="bad id">Bad</x-sirius::message>',
    '<x-sirius::icon name="../bad" />',
    '<x-sirius::icon name="heroicon-o-check" label="" />',
    '<x-sirius::icon name="heroicon-o-check" size="xl" />',
    '<x-sirius::button-group><x-sirius::button>Bad</x-sirius::button></x-sirius::button-group>',
]);
