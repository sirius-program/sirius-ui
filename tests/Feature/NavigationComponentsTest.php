<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Blade;
use Illuminate\View\ViewException;

it('renders breadcrumbs with escaped separators and connected current page semantics', function (): void {
    $html = Blade::render('<x-sirius::breadcrumb label="Project location" :separator="$separator" class="custom"><x-sirius::breadcrumb.item link="/projects" wire:navigate>Projects</x-sirius::breadcrumb.item><x-sirius::breadcrumb.item current>Lake Studio</x-sirius::breadcrumb.item></x-sirius::breadcrumb>', ['separator' => '<script>bad</script>']);

    expect($html)->toContain('<nav', '<ol>', 'aria-label="Project location"', 'custom', 'href="/projects"', 'wire:navigate', 'aria-current="page"', 'aria-hidden="true"', '&lt;script&gt;bad&lt;/script&gt;');
    expect($html)->not->toContain('<script>bad');
    expect(substr_count($html, 'aria-current="page"'))->toBe(1);
});

it('renders a decorative icon separator and respects current links', function (): void {
    $html = Blade::render('<x-sirius::breadcrumb separator-icon="heroicon-o-chevron-right"><x-sirius::breadcrumb.item link="/projects" current aria-current="step">Projects</x-sirius::breadcrumb.item></x-sirius::breadcrumb>');

    expect($html)->toContain('<svg', 'aria-current="page"', 'aria-hidden="true"');
    expect($html)->not->toContain('aria-current="step"');
});

it('shares item content links actions and trailing slot precedence across menu and dropdown', function (string $component): void {
    $html = Blade::render('<x-sirius::' . $component . ' ' . ($component === 'dropdown' ? 'trigger="Actions"' : 'label="Projects"') . '><x-sirius::' . $component . '.item name="Ignored name" trailing="Ignored trailing" icon="heroicon-o-folder" link="/projects" active wire:navigate class="custom" data-record="42"><strong>Projects</strong><x-slot:trailing><kbd>G P</kbd></x-slot:trailing></x-sirius::' . $component . '.item><x-sirius::' . $component . '.item name="Archive" x-on:click="archived = true" wire:click="archive" /></x-sirius::' . $component . '>');

    expect($html)->toContain('href="/projects"', 'wire:navigate', 'custom', 'data-record="42"', '<strong>Projects</strong>', '<kbd>G P</kbd>', '<svg', 'data-active="true"', 'type="button"', 'x-on:click="archived = true"', 'wire:click="archive"');
    expect($html)->not->toContain('Ignored name', 'Ignored trailing', 'type="submit"');
    if ($component === 'menu') {
        expect($html)->toContain('aria-current="page"');
        expect($html)->not->toContain('role="menu"', 'role="menuitem"');
    } else {
        expect(substr_count($html, 'role="menuitem"'))->toBe(2);
    }
})->with(['menu', 'dropdown']);

it('escapes item names links and trailing strings', function (string $component): void {
    $html = Blade::render('<x-sirius::' . $component . '.item :name="$text" :link="$link" :trailing="$text" />', ['text' => '<script>bad</script>', 'link' => '/projects?q=" onclick="bad']);

    expect($html)->toContain('&lt;script&gt;bad&lt;/script&gt;', '/projects?q=&quot; onclick=&quot;bad');
    expect($html)->not->toContain('<script>', ' onclick="');
})->with(['menu', 'dropdown']);

it('removes disabled navigation destinations and protects item state', function (string $component): void {
    $html = Blade::render('<x-sirius::' . $component . '.item name="Archive" link="/dangerous" disabled href="/wrong" aria-disabled="false" type="submit" tabindex="0" />');

    expect($html)->toContain('aria-disabled="true"', 'tabindex="-1"');
    expect($html)->not->toContain('href=', 'type="submit"', 'aria-disabled="false"');
})->with(['menu', 'dropdown']);

it('renders nested submenus with protected trigger relationships and default five character IDs', function (string $component): void {
    $html = Blade::render('<x-sirius::' . $component . '.item name="Export"><x-slot:submenu><x-sirius::' . $component . '.item id="format" name="Format"><x-slot:submenu><x-sirius::' . $component . '.item name="PDF" /></x-slot:submenu></x-sirius::' . $component . '.item></x-slot:submenu></x-sirius::' . $component . '.item>');

    preg_match('/id="([a-zA-Z0-9]{5})"/', $html, $matches);
    expect($matches)->toHaveCount(2);
    expect($html)->toContain('aria-controls="' . ($matches[1] ?? '') . '-submenu"', 'id="format-submenu"', 'aria-controls="format-submenu"', 'data-sir-submenu-trigger', 'aria-expanded="false"', ' hidden');
    if ($component === 'dropdown') {
        expect(substr_count($html, 'role="menu"'))->toBe(2);
        expect($html)->toContain('aria-haspopup="menu"', 'aria-labelledby="format"');
    }
})->with(['menu', 'dropdown']);

it('renders dropdown root state trigger content and consumer attributes with safe identities', function (): void {
    $html = Blade::render('<x-sirius::dropdown open align="end" class="custom" wire:key="actions"><x-slot:trigger class="custom-trigger" type="submit"><strong>Project actions</strong></x-slot:trigger><x-sirius::dropdown.item name="Save" /></x-sirius::dropdown>');

    preg_match('/<div id="([a-zA-Z0-9]{5})"/', $html, $matches);
    expect($matches)->toHaveCount(2);
    $id = $matches[1] ?? '';
    expect($html)->toContain('id="' . $id . '-trigger"', 'aria-controls="' . $id . '-menu"', 'aria-labelledby="' . $id . '-trigger"', 'data-initial-open="true"', 'data-align="end"', 'custom-trigger', 'wire:key="actions"', '<strong>Project actions</strong>');
    expect($html)->not->toContain('type="submit"');
});

it('uses translatable default navigation labels and a customized component namespace', function (): void {
    app('translator')->addLines(['sirius-ui.breadcrumb.label' => 'Position', 'sirius-ui.menu.label' => 'Browse'], 'en', 'sirius');
    Blade::anonymousComponentPath(__DIR__ . '/../../resources/views/components', 'custom');

    $html = Blade::render('<x-custom::breadcrumb><x-custom::breadcrumb.item current>Project</x-custom::breadcrumb.item></x-custom::breadcrumb><x-custom::menu><x-custom::menu.item name="Projects" /></x-custom::menu><x-custom::dropdown trigger="Actions"><x-custom::dropdown.item name="Archive" /></x-custom::dropdown>');

    expect($html)->toContain('aria-label="Position"', 'aria-label="Browse"', 'sir-dropdown', 'Archive');
});

it('rejects ambiguous or invalid navigation component contracts', function (string $template): void {
    expect(fn (): string => Blade::render($template))->toThrow(ViewException::class);
})->with([
    '<x-sirius::breadcrumb label="" />', '<x-sirius::breadcrumb :separator="[]" />',
    '<x-sirius::breadcrumb.item current="false">Project</x-sirius::breadcrumb.item>',
    '<x-sirius::breadcrumb.item link="javascript:alert(1)">Project</x-sirius::breadcrumb.item>',
    '<x-sirius::menu label="" />', '<x-sirius::menu.item />', '<x-sirius::menu.item :name="[]" />',
    '<x-sirius::menu.item name="Project" :trailing="4" />', '<x-sirius::menu.item name="Project" disabled="false" />',
    '<x-sirius::dropdown.item name="Project" active="false" />', '<x-sirius::menu.item name="Project" link="data:text/html,bad" />',
    '<x-sirius::menu.item name="Project" link="/projects"><x-slot:submenu><x-sirius::menu.item name="Child" /></x-slot:submenu></x-sirius::menu.item>',
    '<x-sirius::dropdown trigger="Actions" id="bad id" />', '<x-sirius::dropdown />',
    '<x-sirius::dropdown trigger="Actions" align="middle" />', '<x-sirius::dropdown trigger="Actions" open="false" />',
]);

it('rejects control characters that could disguise an executable link scheme', function (string $component): void {
    expect(fn (): string => Blade::render('<x-sirius::' . $component . '.item :link="$url">Project</x-sirius::' . $component . '.item>', ['url' => "java\nscript:alert(1)"]))->toThrow(ViewException::class);
})->with(['breadcrumb', 'menu', 'dropdown']);
