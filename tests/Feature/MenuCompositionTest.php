<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Blade;
use Illuminate\View\ViewException;

it('renders categories and stateful submenus with valid list parentage', function (): void {
    $html = Blade::render('<x-sirius::menu label="Workspace"><x-sirius::menu.category :title="$title" icon="heroicon-o-users" class="category-custom"><x-sirius::menu.item link="/team" active wire:navigate>Team home</x-sirius::menu.item><x-sirius::menu.item id="projects" :name="$title" open transition class="item-custom" wire:key="projects" data-record="42"><x-slot:submenu><x-sirius::menu.item wire:click="save">Save</x-sirius::menu.item></x-slot:submenu></x-sirius::menu.item><x-sirius::menu.item id="account" name="Account"><x-slot:submenu><x-sirius::menu.item link="/account">Profile</x-sirius::menu.item></x-slot:submenu></x-sirius::menu.item></x-sirius::menu.category></x-sirius::menu>', ['title' => '<script>bad</script>']);

    expect($html)->toContain('&lt;script&gt;bad&lt;/script&gt;', '<svg', 'category-custom', 'item-custom', 'wire:key="projects"', 'data-record="42"', 'wire:click="save"', 'aria-current="page"', 'wire:navigate');
    expect($html)->not->toContain('<script>', 'role="menu"', '<details', '<summary');

    $document = new DOMDocument;
    $document->loadHTML($html, LIBXML_NOERROR | LIBXML_NOWARNING);
    $xpath = new DOMXPath($document);
    foreach ([
        '//ul/*[not(self::li)]'                                                                                               => 0,
        '//li[not(parent::ul)]'                                                                                               => 0,
        '//nav'                                                                                                               => 1,
        '//button[@id="projects" and @data-initial-open="true" and @*[name()="wire:key"]="projects"]'                         => 1,
        '//ul[@id="account-submenu" and @hidden]'                                                                             => 1,
        '//button[@id="projects" and @aria-controls="projects-submenu" and @data-record="42"]'                                => 1,
        '//ul[@id="projects-submenu" and not(@hidden) and @data-transition="true"]/li/button[@*[name()="wire:click"]="save"]' => 1,
    ] as $query => $count) {
        $nodes = $xpath->query($query);
        if ($nodes === false) {
            throw new LogicException('Invalid menu structure assertion.');
        }
        expect($nodes->length)->toBe($count);
    }
});

it('uses a customized namespace for submenu items', function (): void {
    Blade::anonymousComponentPath(__DIR__ . '/../../resources/views/components', 'custom');
    $html = Blade::render('<x-custom::menu><x-custom::menu.category title="Workspace"><x-custom::menu.item name="Projects" open><x-slot:submenu><x-custom::menu.item link="/projects">Projects</x-custom::menu.item></x-slot:submenu></x-custom::menu.item></x-custom::menu.category></x-custom::menu>');

    preg_match('/id="([a-zA-Z0-9]{5})"/', $html, $matches);
    expect($matches)->toHaveCount(2);
    expect($html)->toContain('data-sir-submenu-trigger', 'aria-expanded="true"', 'aria-controls="' . ($matches[1] ?? '') . '-submenu"', 'href="/projects"');
});

it('renders submenu state and transitions without an extra mode attribute', function (): void {
    $html = Blade::render('<x-sirius::menu><x-sirius::menu.item id="team" name="Team" open transition><x-slot:submenu><x-sirius::menu.item>Save</x-sirius::menu.item></x-slot:submenu></x-sirius::menu.item></x-sirius::menu>');

    expect($html)->toContain('id="team-submenu"', 'aria-controls="team-submenu"', 'aria-expanded="true"', 'data-transition="true"', '>Save<');
    expect($html)->not->toContain('<details', '<summary', ' hidden');
});

it('forwards trigger content and trailing slots while protecting disabled state and relationships', function (): void {
    $html = Blade::render('<x-sirius::menu><x-sirius::menu.item id="settings" name="Ignored" trailing="Ignored trailing" open disabled active aria-disabled="false" aria-controls="wrong" tabindex="0" class="custom" x-on:click="clicked++" wire:click="save" wire:key="settings" x-bind:open="expanded"><strong>Settings</strong><x-slot:trailing><kbd>S</kbd></x-slot:trailing><x-slot:submenu><x-sirius::menu.item link="/settings">Appearance</x-sirius::menu.item></x-slot:submenu></x-sirius::menu.item></x-sirius::menu>');

    expect($html)->toContain('<strong>Settings</strong>', '<kbd>S</kbd>', 'custom', 'aria-disabled="true"', 'tabindex="-1"', 'data-active="true"', 'aria-controls="settings-submenu"', 'wire:key="settings"', 'x-bind:data-initial-open="expanded"', 'x-on:click="clicked++"', 'wire:click="save"');
    expect($html)->not->toContain('Ignored', 'aria-disabled="false"', 'aria-controls="wrong"', 'tabindex="0"', 'data-initial-open="true"');
});

it('rejects invalid menu category and item contracts', function (string $template): void {
    expect(fn (): string => Blade::render($template))->toThrow(ViewException::class);
})->with([
    '<x-sirius::menu.category />', '<x-sirius::menu.category title=" " />',
    '<x-sirius::menu.category :title="[]" />', '<x-sirius::menu.category title="Team" :icon="[]" />',
    '<x-sirius::menu.item />', '<x-sirius::menu.item :name="[]" />',
    '<x-sirius::menu.item name=" " />', '<x-sirius::menu.item name="Team" icon="" />',
    '<x-sirius::menu.item name="Team" id="bad id" />',
    '<x-sirius::menu.item name="Team" :open="[]" />',
    '<x-sirius::menu.item name="Team" open="false" />',
    '<x-sirius::menu.item name="Team" transition="false" />',
    '<x-sirius::menu.item name="Team" :transition="[]" />',
    '<x-sirius::menu.item name="Team" link="/team"><x-slot:submenu><x-sirius::menu.item>Child</x-sirius::menu.item></x-slot:submenu></x-sirius::menu.item>',
    '<x-sirius::menu.item name="Team" :open="1" />',
]);
