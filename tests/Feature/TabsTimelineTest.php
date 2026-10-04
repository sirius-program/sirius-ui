<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Blade;
use Illuminate\View\ViewException;

it('renders stable tab associations and keeps inactive panel controls mounted but hidden', function (): void {
    $html = Blade::render('<x-sirius::tabs id="project" :items="$items" active="notes" label="Project sections" class="custom" list-class="list-custom" panel-class="panel-custom" wire:key="project" x-on:tabs:change="selected = $event.detail.value"><x-slot:panel-overview class="overview-custom" id="wrong" role="wrong" aria-labelledby="wrong"><input name="title" value="Website" /></x-slot:panel-overview><x-slot:panel-notes><textarea name="notes">Draft</textarea></x-slot:panel-notes></x-sirius::tabs>', ['items' => ['overview' => 'Overview', 'notes' => ['label' => 'Notes', 'icon' => 'heroicon-o-document-text']]]);

    $dom = new DOMDocument;
    @$dom->loadHTML($html);
    $xpath = new DOMXPath($dom);
    $overview = $dom->getElementById('project-panel-overview');
    $notes = $dom->getElementById('project-panel-notes');
    expect($dom->getElementById('project-tab-notes')?->getAttribute('aria-controls'))->toBe('project-panel-notes');
    expect($dom->getElementById('project-tab-notes')?->getAttribute('aria-selected'))->toBe('true');
    expect($dom->getElementById('project-tab-overview')?->getAttribute('tabindex'))->toBe('-1');
    expect($overview?->hasAttribute('hidden'))->toBeTrue();
    expect($overview?->hasAttribute('inert'))->toBeTrue();
    expect($notes?->hasAttribute('hidden'))->toBeFalse();
    expect($notes?->getAttribute('role'))->toBe('tabpanel');
    expect($notes?->getAttribute('aria-labelledby'))->toBe('project-tab-notes');
    expect($xpath->query('//input[@name="title"]'))->toHaveCount(1);
    expect($html)->toContain('value="Website"', '>Draft</textarea>', 'list-custom', 'panel-custom', 'overview-custom', 'custom', 'wire:key="project"', 'x-on:tabs:change=', 'aria-label="Project sections"');
    expect($html)->not->toContain('id="wrong"', 'role="wrong"', 'aria-labelledby="wrong"');
});

it('chooses the first enabled tab for missing unavailable or disabled active values', function (?string $active): void {
    $html = Blade::render('<x-sirius::tabs :items="$items" :active="$active" orientation="vertical" activation="manual"><x-slot:panel-disabled>Unavailable</x-slot:panel-disabled><x-slot:panel-overview>Overview</x-slot:panel-overview></x-sirius::tabs>', ['items' => ['disabled' => ['label' => 'Disabled', 'disabled' => true], 'overview' => 'Overview'], 'active' => $active]);

    expect($html)->toContain('data-selected="overview"', 'aria-orientation="vertical"', 'data-activation="manual"', ' disabled');
    preg_match('/<div id="([a-zA-Z0-9]{5})"/', $html, $matches);
    expect($matches)->toHaveCount(2);
    expect($html)->toContain('id="' . ($matches[1] ?? '') . '-tab-overview"', 'id="' . ($matches[1] ?? '') . '-panel-overview"');
})->with([null, 'missing', 'disabled']);

it('leaves every panel hidden when all tabs are disabled and escapes tab labels', function (): void {
    $html = Blade::render('<x-sirius::tabs id="locked" :items="$items"><x-slot:panel-overview>Private</x-slot:panel-overview></x-sirius::tabs>', ['items' => ['overview' => ['label' => '<script>bad()</script>', 'disabled' => true]]]);

    expect($html)->toContain('data-selected=""', 'aria-selected="false"', 'tabindex="-1"', 'hidden inert', '&lt;script&gt;bad()&lt;/script&gt;');
    expect($html)->not->toContain('<script>bad()');
});

it('renders timeline states titles descriptions markers and consumer content', function (): void {
    $html = Blade::render('<x-sirius::timeline label="Account setup" class="custom"><x-sirius::timeline.item title="Account" description="Create your account" state="completed" /><x-sirius::timeline.item title="Profile" state="current" icon="heroicon-o-user" :number="2" data-step="profile"><a href="/profile">Edit profile</a></x-sirius::timeline.item><x-sirius::timeline.item title="Preferences" description="Choose your settings" :number="3" /><x-sirius::timeline.item title="Review"><x-slot:marker><span>4</span></x-slot:marker></x-sirius::timeline.item></x-sirius::timeline>');

    expect($html)->toContain('<ol', 'aria-label="Account setup"', 'custom', 'data-state="completed"', 'data-state="current"', 'data-state="upcoming"', 'aria-current="step"', 'Create your account', 'Choose your settings', 'data-step="profile"', '<a href="/profile">Edit profile</a>', '<span>4</span>');
    expect(substr_count($html, 'aria-current="step"'))->toBe(1);
    expect(substr_count($html, 'class="sir-icon'))->toBe(2);
});

it('escapes timeline text but accepts explicit title and marker slots', function (): void {
    $text = '<script>bad()</script>';
    $html = Blade::render('<x-sirius::timeline><x-sirius::timeline.item :title="$text" :description="$text" /><x-sirius::timeline.item title="Ignored" icon="heroicon-o-check" :number="2"><x-slot:title><a href="/invoice">Invoice sent</a></x-slot:title><x-slot:marker><strong>A</strong></x-slot:marker><p>Sent today</p></x-sirius::timeline.item></x-sirius::timeline>', ['text' => $text]);

    expect($html)->toContain('&lt;script&gt;bad()&lt;/script&gt;', '<a href="/invoice">Invoice sent</a>', '<strong>A</strong>', '<p>Sent today</p>');
    expect($html)->not->toContain('<script>bad()', 'Ignored', 'class="sir-icon');
});

it('uses translated names and timeline states with a customized Blade namespace', function (): void {
    app('translator')->addLines(['sirius-ui.tabs.label' => 'Sections', 'sirius-ui.timeline.label' => 'Setup', 'sirius-ui.timeline.completed' => 'Done'], 'en', 'sirius');
    Blade::anonymousComponentPath(__DIR__ . '/../../resources/views/components', 'custom');
    $html = Blade::render('<x-custom::tabs :items="[\'overview\' => \'Overview\']"><x-slot:panel-overview>Content</x-slot:panel-overview></x-custom::tabs><x-custom::timeline><x-custom::timeline.item title="Account" state="completed" /></x-custom::timeline>');

    expect($html)->toContain('aria-label="Sections"', 'aria-label="Setup"', 'Done');
});

it('rejects invalid tab and timeline contracts', function (string $template): void {
    expect(fn (): string => Blade::render($template))->toThrow(ViewException::class);
})->with([
    '<x-sirius::tabs :items="[]" />',
    '<x-sirius::tabs :items="[\'overview\' => \'Overview\']" />',
    '<x-sirius::tabs :items="[\'bad name\' => \'Overview\']" />',
    '<x-sirius::tabs :items="[\'my-tab\' => \'Overview\', \'my_tab\' => \'Other\']"><x-slot:panel-my-tab>Overview</x-slot:panel-my-tab></x-sirius::tabs>',
    '<x-sirius::tabs :items="[\'overview\' => [\'label\' => \'Overview\', \'disabled\' => \'false\']]" />',
    '<x-sirius::tabs id="bad id" :items="[\'overview\' => \'Overview\']" />',
    '<x-sirius::tabs :items="[\'overview\' => \'Overview\']" orientation="diagonal" />',
    '<x-sirius::tabs :items="[\'overview\' => \'Overview\']" activation="hover" />',
    '<x-sirius::tabs :items="[\'overview\' => \'Overview\']" :active="[]" />',
    '<x-sirius::timeline label=" " />',
    '<x-sirius::timeline.item title=" " />',
    '<x-sirius::timeline.item title="Account" state="failed" />',
    '<x-sirius::timeline.item title="Account" :number="0" />',
    '<x-sirius::timeline.item title="Account" :description="[]" />',
]);
