<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Blade;
use Illuminate\View\ViewException;

it('renders escaped notification content with caller owned footer and stable attributes', function (): void {
    $html = Blade::render('<x-sirius::toast id="saved" :title="$unsafe" :text="$unsafe" icon="heroicon-o-check-circle" open :duration="0" class="custom" style="width:20rem" wire:key="saved" x-on:toast:close="closed = true" data-record="12" data-duration="9" data-open="false"><x-slot:footer class="actions"><button wire:click="undo">Undo</button></x-slot:footer></x-sirius::toast>', ['unsafe' => '<script>bad</script>']);

    expect($html)->toContain('id="saved"', 'id="saved-panel"', 'id="saved-title"', 'id="saved-text"', 'id="saved-footer"', 'popover="manual" inert', 'custom', 'actions', 'wire:click="undo"', 'wire:key="saved"', 'x-on:toast:close=', 'data-record="12"', 'data-open="true"', 'data-duration="0"', '&lt;script&gt;bad&lt;/script&gt;');
    expect($html)->not->toContain('<script>bad', 'data-duration="9"', 'data-open="false"');
});

it('generates one five character ID for its content and uses translated close controls', function (): void {
    app('translator')->addLines(['sirius-ui.dialog.close' => 'Tutup'], 'en', 'sirius');
    Blade::anonymousComponentPath(__DIR__ . '/../../resources/views/components', 'custom');
    $html = Blade::render('<x-custom::toast text="Saved" />');

    preg_match('/<div id="([a-zA-Z0-9]{5})"/', $html, $matches);
    expect($matches)->toHaveCount(2);
    expect($html)->toContain('id="' . ($matches[1] ?? '') . '-panel"', 'id="' . ($matches[1] ?? '') . '-text"', 'type="button"', 'aria-label="Tutup"', 'data-position="top-end"', 'data-duration="5000"', 'data-open="false"');
    expect($html)->not->toContain('sir-toast-icon', 'sir-toast-title', 'sir-toast-footer');
});

it('uses global duration while preserving explicit duration including zero', function (): void {
    config(['sirius-ui.toast.duration' => '8000']);
    expect(Blade::render('<x-sirius::toast text="Saved" />'))->toContain('data-duration="8000"');
    $persistent = Blade::render('<x-sirius::toast text="Saved" :duration="0" :closable="false" />');
    expect($persistent)->toContain('data-duration="0"');
    expect($persistent)->not->toContain('sir-toast-dismiss');
    config(['sirius-ui.toast.duration' => 'invalid']);
    expect(Blade::render('<x-sirius::toast text="Saved" :duration="1200" />'))->toContain('data-duration="1200"');
    expect(fn (): string => Blade::render('<x-sirius::toast text="Saved" />'))->toThrow(ViewException::class);
});

it('uses global position unless a component position is supplied and rejects invalid configuration', function (): void {
    config(['sirius-ui.toast.position' => 'bottom-start']);
    expect(Blade::render('<x-sirius::toast text="Saved" />'))->toContain('data-position="bottom-start"');
    expect(Blade::render('<x-sirius::toast text="Saved" position="top-center" />'))->toContain('data-position="top-center"');

    config(['sirius-ui.toast.position' => 'invalid']);
    expect(Blade::render('<x-sirius::toast text="Saved" position="bottom-end" />'))->toContain('data-position="bottom-end"');
    expect(fn (): string => Blade::render('<x-sirius::toast text="Saved" />'))->toThrow(ViewException::class);
});

it('supports each notification variant and viewport position', function (string $variant, string $position): void {
    $html = Blade::render('<x-sirius::toast text="Saved" :variant="$variant" :position="$position" />', ['variant' => $variant, 'position' => $position]);

    expect($html)->toContain('sir-tone--' . $variant, 'data-position="' . $position . '"');
    expect($html)->not->toContain(' variant=', ' position=');
})->with([
    ['primary', 'top-start'], ['info', 'top-center'], ['secondary', 'top-end'], ['success', 'bottom-start'],
    ['danger', 'bottom-center'], ['warning', 'bottom-end'], ['ghost', 'top-start'], ['outline', 'top-start'],
]);

it('rejects invalid notification props and unsupported content', function (string $template): void {
    expect(fn (): string => Blade::render($template))->toThrow(ViewException::class);
})->with([
    '<x-sirius::toast />', '<x-sirius::toast text=" " />', '<x-sirius::toast :text="[]" />',
    '<x-sirius::toast text="Saved" title=" " />', '<x-sirius::toast text="Saved" :icon="[]" />',
    '<x-sirius::toast text="Saved" icon="bad-icon" />', '<x-sirius::toast text="Saved" id="bad id" />',
    '<x-sirius::toast text="Saved" variant="link" />', '<x-sirius::toast text="Saved" position="left" />',
    '<x-sirius::toast text="Saved" :duration="-1" />', '<x-sirius::toast text="Saved" :duration="1.5" />',
    '<x-sirius::toast text="Saved" :duration="true" />', '<x-sirius::toast text="Saved" duration="bad" />',
    '<x-sirius::toast text="Saved" :duration="2147483648" />', '<x-sirius::toast text="Saved" open="false" />',
    '<x-sirius::toast text="Saved" closable="false" />', '<x-sirius::toast text="Saved" footer="Text" />',
    '<x-sirius::toast text="Saved"><strong>Unexpected</strong></x-sirius::toast>',
]);
