<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Blade;
use Illuminate\View\ViewException;
use Sirius\Ui\SiriusUiServiceProvider;

it('renders an escaped accessible prompt and leaves footer actions to the caller', function (): void {
    $html = Blade::render('<x-sirius::alert id="archive" :text="$text" icon="heroicon-o-exclamation-triangle" open initial-focus="#cancel" :close-on-escape="false" :close-on-backdrop="false" class="custom" data-sir-alert="wrong"><x-slot:footer class="footer-class"><a href="/projects">Projects</a><button id="cancel" type="button" data-sir-dialog-close>Cancel</button><button wire:click="archive">Archive</button></x-slot:footer></x-sirius::alert>', ['text' => '<script>bad</script>']);

    expect($html)->toContain('<dialog id="archive"', 'data-sir-dialog', 'data-sir-alert', 'aria-labelledby="archive-text"', 'id="archive-text"', '&lt;script&gt;bad&lt;/script&gt;', 'id="archive-footer"', 'footer-class', 'wire:click="archive"', 'href="/projects"', 'data-open="true"', 'data-close-on-escape="false"', 'data-close-on-backdrop="false"', 'data-initial-focus="#cancel"', 'custom');
    expect($html)->not->toContain('<script>bad', 'sir-dialog-heading', 'data-sir-alert="wrong"');
});

it('supports iconless prompts with generated IDs and optional close controls', function (): void {
    app('translator')->addLines(['sirius-ui.dialog.close' => 'Tutup'], 'en', 'sirius');
    $html = Blade::render('<x-sirius::alert text="Saved" closable />');
    expect($html)->toMatch('/<dialog id="[a-zA-Z0-9]{5}"/')->toContain('aria-label="Tutup"', 'data-open="false"', 'sir-tone--info');
    expect($html)->not->toContain('sir-alert-icon', 'sir-dialog-footer');
});

it('renders an escaped title between the icon and text with accessible heading and description', function (): void {
    $html = Blade::render('<x-sirius::alert id="saved" :title="$title" text="Project settings were saved." icon="heroicon-o-check-circle" />', ['title' => '<script>unsafe</script>']);
    expect($html)->toContain('id="saved-title" class="sir-alert-title"', '&lt;script&gt;unsafe&lt;/script&gt;', 'aria-labelledby="saved-title"', 'aria-describedby="saved-text"');
    expect($html)->not->toContain('<script>unsafe</script>', ' title=');
    expect($html)->toMatch('/sir-alert-icon.*<h2 id="saved-title".*<p id="saved-text"/s');
});

it('preserves consumer accessible labels and descriptions for titled prompts', function (): void {
    $html = Blade::render('<x-sirius::alert id="saved" title="Saved" text="Settings updated." aria-label="Custom name" aria-describedby="custom-help" />');
    expect($html)->toContain('aria-label="Custom name"', 'aria-describedby="custom-help"');
    expect($html)->not->toContain('aria-labelledby=', 'aria-describedby="saved-text"');
});

it('accepts the standard presentation variants without forwarding variant as HTML', function (string $variant): void {
    $html = Blade::render('<x-sirius::alert text="Saved" :variant="$variant" />', ['variant' => $variant]);
    expect($html)->toContain('sir-tone--' . $variant);
    expect($html)->not->toContain(' variant=');
})->with(['primary', 'info', 'success', 'danger', 'warning', 'secondary', 'ghost', 'outline']);

it('composes both overlays with a configured public namespace', function (): void {
    config(['sirius-ui.blade_namespace' => 'custom']);
    (new SiriusUiServiceProvider(app()))->boot();
    $html = Blade::render('<x-custom::alert text="Saved" /><x-custom::slideover header="Order">Details</x-custom::slideover>');
    expect($html)->toContain('sir-alert', 'sir-slideover', 'Details');
});

it('rejects unsupported prompt content and invalid contracts', function (string $template): void {
    expect(fn (): string => Blade::render($template))->toThrow(ViewException::class);
})->with([
    'missing text'        => '<x-sirius::alert />',
    'empty text'          => '<x-sirius::alert text=" " />',
    'array text'          => '<x-sirius::alert :text="[]" />',
    'empty title'         => '<x-sirius::alert title=" " text="Saved" />',
    'array title'         => '<x-sirius::alert :title="[]" text="Saved" />',
    'default HTML'        => '<x-sirius::alert text="Saved"><strong>Unexpected</strong></x-sirius::alert>',
    'text footer'         => '<x-sirius::alert text="Saved" footer="Unexpected" />',
    'array icon'          => '<x-sirius::alert text="Saved" :icon="[]" />',
    'invalid icon'        => '<x-sirius::alert text="Saved" icon="&lt;script&gt;" />',
    'invalid ID'          => '<x-sirius::alert id="bad id" text="Saved" />',
    'invalid size'        => '<x-sirius::alert size="bad" text="Saved" />',
    'invalid variant'     => '<x-sirius::alert variant="bad" text="Saved" />',
    'button-only variant' => '<x-sirius::alert variant="link" text="Saved" />',
    'string state'        => '<x-sirius::alert text="Saved" open="false" />',
    'string close'        => '<x-sirius::alert text="Saved" closable="false" />',
]);
