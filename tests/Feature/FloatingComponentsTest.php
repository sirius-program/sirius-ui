<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Blade;
use Illuminate\View\ViewException;

it('renders escaped tooltip text without interactive content while retaining trigger attributes', function (): void {
    $html = Blade::render('<x-sirius::tooltip id="help" :text="$text" class="custom" wire:key="help"><button type="button" id="help-trigger" aria-describedby="existing-help" x-on:click="count++" wire:click="increment">Help</button></x-sirius::tooltip>', ['text' => '<button onclick="bad()">Bad</button>']);

    expect($html)->toContain('id="help-content"', 'role="tooltip"', 'popover="manual"', 'custom', 'wire:key="help"', 'id="help-trigger"', 'aria-describedby="existing-help"', 'x-on:click="count++"', 'wire:click="increment"', '&lt;button onclick=&quot;bad()&quot;&gt;Bad&lt;/button&gt;');
    expect($html)->not->toContain('<button onclick="bad()">', 'aria-modal=', 'role="dialog"');
});

it('renders labeled nonmodal popovers with HTML and consumer owned controls', function (): void {
    $html = Blade::render('<x-sirius::popover id="sharing" label="Sharing options" open placement="right" wrapper-class="custom-wrapper" class="custom-content" wire:key="sharing"><x-slot:trigger><button id="sharing-trigger" type="button" aria-label="Share project" x-on:click="count++">Share</button></x-slot:trigger><h2>Share project</h2><input name="email" /><button type="button" data-sir-popover-close>Done</button></x-sirius::popover>');

    expect($html)->toContain('id="sharing-content"', 'role="dialog"', 'aria-modal="false"', 'aria-label="Sharing options"', 'data-initial-open="true"', 'data-placement="right"', 'custom-content', 'wire:key="sharing"', 'aria-label="Share project"', 'x-on:click="count++"', '<h2>Share project</h2>', 'name="email"', 'data-sir-popover-close');
    expect($html)->not->toContain('<dialog', 'role="tooltip"');

    $dom = new DOMDocument;
    @$dom->loadHTML($html);
    $wrapper = $dom->getElementById('sharing');
    $panel = $dom->getElementById('sharing-content');
    expect($wrapper?->getAttribute('class'))->toContain('sir-floating', 'custom-wrapper');
    expect($wrapper?->getAttribute('class'))->not->toContain('custom-content');
    expect($panel?->getAttribute('class'))->toContain('sir-popover', 'custom-content');
    expect($panel?->getAttribute('class'))->not->toContain('custom-wrapper');
    expect($wrapper?->getAttribute('wire:key'))->toBe('sharing');
    expect($panel?->hasAttribute('wire:key'))->toBeFalse();
});

it('renders every floating variant with shared theme tokens', function (string $component, string $variant): void {
    $template = $component === 'tooltip'
        ? '<x-sirius::tooltip text="Project help" :variant="$variant"><button>Help</button></x-sirius::tooltip>'
        : '<x-sirius::popover :variant="$variant"><x-slot:trigger><button>Help</button></x-slot:trigger> Project help</x-sirius::popover>';

    $html = Blade::render($template, ['variant' => $variant]);

    expect($html)->toContain('sir-' . $component, 'sir-tone--' . $variant);
})->with(['tooltip', 'popover'])->with(['info', 'primary', 'secondary', 'warning', 'success', 'danger']);

it('generates five character IDs and preserves explicit floating identities', function (string $component): void {
    $template = $component === 'tooltip'
        ? '<x-sirius::tooltip :id="$id" text="Help"><button>Help</button></x-sirius::tooltip>'
        : '<x-sirius::popover :id="$id"><x-slot:trigger><button>Help</button></x-slot:trigger> Help</x-sirius::popover>';
    $html = Blade::render($template, ['id' => null]);

    preg_match('/<(?:span|div) id="([a-zA-Z0-9]{5})"/', $html, $matches);
    expect($matches)->toHaveCount(2);
    expect($html)->toContain('id="' . ($matches[1] ?? '') . '-content"', 'sir-tone--info');

    $explicit = Blade::render($template, ['id' => 'project-help']);
    expect($explicit)->toContain('id="project-help"', 'id="project-help-content"');
})->with(['tooltip', 'popover']);

it('uses a translated default popover label and a customized Blade namespace', function (): void {
    app('translator')->addLines(['sirius-ui.popover.label' => 'Details'], 'en', 'sirius');
    Blade::anonymousComponentPath(__DIR__ . '/../../resources/views/components', 'custom');

    $html = Blade::render('<x-custom::tooltip text="Help"><button>Help</button></x-custom::tooltip><x-custom::popover><x-slot:trigger><button>Details</button></x-slot:trigger> Details content</x-custom::popover>');

    expect($html)->toContain('role="tooltip"', 'role="dialog"', 'aria-label="Details"');
});

it('escapes popover accessible names and protects panel semantics from root attributes', function (): void {
    $html = Blade::render('<x-sirius::popover :label="$label" data-open="true" data-initial-open="true" data-sir-floating="tooltip" data-placement="wrong"><x-slot:trigger><button>Help</button></x-slot:trigger> Content</x-sirius::popover>', ['label' => '"><script>bad()</script>']);

    expect($html)->toContain('aria-label="&quot;&gt;&lt;script&gt;bad()&lt;/script&gt;"', 'data-initial-open="false"', 'data-sir-floating="popover"', 'data-placement="bottom"');
    expect($html)->not->toContain('<script>bad', 'data-open="true"', 'data-placement="wrong"');
});

it('rejects invalid floating contracts and empty content or triggers', function (string $template): void {
    expect(fn (): string => Blade::render($template))->toThrow(ViewException::class);
})->with([
    '<x-sirius::tooltip text="Help" />', '<x-sirius::tooltip text=""><button>Help</button></x-sirius::tooltip>',
    '<x-sirius::tooltip :text="[]"><button>Help</button></x-sirius::tooltip>',
    '<x-sirius::tooltip text="Help" id="bad id"><button>Help</button></x-sirius::tooltip>',
    '<x-sirius::tooltip text="Help" placement="center"><button>Help</button></x-sirius::tooltip>',
    '<x-sirius::tooltip text="Help" variant="ghost"><button>Help</button></x-sirius::tooltip>',
    '<x-sirius::tooltip text="Help" variant="default"><button>Help</button></x-sirius::tooltip>',
    '<x-sirius::popover variant="default"><x-slot:trigger><button>Help</button></x-slot:trigger> Content</x-sirius::popover>',
    '<x-sirius::popover>Content</x-sirius::popover>',
    '<x-sirius::popover><x-slot:trigger><button>Help</button></x-slot:trigger></x-sirius::popover>',
    '<x-sirius::popover label=""><x-slot:trigger><button>Help</button></x-slot:trigger> Content</x-sirius::popover>',
    '<x-sirius::popover open="false"><x-slot:trigger><button>Help</button></x-slot:trigger> Content</x-sirius::popover>',
    '<x-sirius::popover :wrapper-class="[]"><x-slot:trigger><button>Help</button></x-slot:trigger> Content</x-sirius::popover>',
]);
