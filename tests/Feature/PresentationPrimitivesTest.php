<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Blade;
use Illuminate\View\ViewException;

it('renders initials for absent images including Unicode and single word names', function (string $name, string $initials): void {
    $html = Blade::render('<x-sirius::avatar :fallback="$name" :alt="$name" />', ['name' => $name]);

    expect($html)->toContain('role="img"', 'data-avatar-fallback', $initials, 'data-image-ready="false"');
    expect($html)->not->toContain('<img');
})->with([['Nadia Putri', 'NP'], ['  Élodie   Martin  ', 'ÉM'], ['Sirius', 'S'], ['李小龙', '李']]);

it('reserves the requested avatar size and shape while forwarding wrapper attributes', function (string $size, string $variant): void {
    $html = Blade::render('<x-sirius::avatar src="/profile.jpg" alt="Nadia Putri" fallback="Nadia Putri" :size="$size" :variant="$variant" id="member" class="custom" data-record="42" wire:key="member-avatar" />', ['size' => $size, 'variant' => $variant]);

    expect($html)->toContain('sir-avatar--' . $size, 'sir-avatar--' . $variant, 'id="member"', 'custom', 'data-record="42"', 'wire:key="member-avatar"', 'src="/profile.jpg"', 'aria-label="Nadia Putri"');
    expect(substr_count($html, 'role="img"'))->toBe(1);
})->with([['sm', 'circle'], ['md', 'circle'], ['lg', 'circle'], ['xl', 'circle'], ['md', 'rounded']]);

it('keeps unnamed avatars decorative and supports a consumer accessible name', function (): void {
    $decorative = Blade::render('<x-sirius::avatar src="" />');
    expect($decorative)->toContain('aria-hidden="true"', '<svg');
    expect($decorative)->not->toContain('<img', 'role="img"');

    $named = Blade::render('<x-sirius::avatar alt="Default" aria-label="Workspace" fallback="Lake Studio" />');
    expect($named)->toContain('role="img"', 'aria-label="Workspace"');
    expect($named)->not->toContain('aria-label="Default"');
});

it('escapes avatar sources descriptions and initials instead of inserting markup', function (): void {
    $html = Blade::render('<x-sirius::avatar :src="$source" :alt="$description" :fallback="$name" />', [
        'source'      => 'photo.jpg" onerror="alert(1)',
        'description' => '<script>alert(1)</script>',
        'name'        => '<script>',
    ]);

    expect($html)->toContain('photo.jpg&quot; onerror=&quot;alert(1)', '&lt;script&gt;alert(1)&lt;/script&gt;');
    expect($html)->not->toContain(' onerror="', '<script>');
});

it('renders horizontal and vertical separators with protected semantic or decorative state', function (string $orientation, bool $decorative): void {
    $html = Blade::render('<x-sirius::separator :orientation="$orientation" :decorative="$decorative" id="section" class="custom" data-section="billing" role="button" aria-orientation="wrong" aria-hidden="false" />', ['orientation' => $orientation, 'decorative' => $decorative]);

    expect($html)->toContain($orientation === 'horizontal' ? '<hr' : '<div', 'id="section"', 'custom', 'data-section="billing"');
    expect($html)->not->toContain('role="button"', 'aria-orientation="wrong"', 'aria-hidden="false"');
    if ($decorative) {
        expect($html)->toContain('role="none"', 'aria-hidden="true"');
        expect($html)->not->toContain('aria-orientation=');
    } else {
        expect($html)->toContain('role="separator"', 'aria-orientation="' . $orientation . '"');
    }
})->with([['horizontal', false], ['vertical', false], ['horizontal', true], ['vertical', true]]);

it('renders sized skeletons without exposing placeholders as accessible or focusable content', function (string $shape): void {
    $html = Blade::render('<x-sirius::skeleton :shape="$shape" :width="48" height="3rem" class="custom" style="margin: 2px" data-loading="profile" aria-hidden="false" role="status" tabindex="0" />', ['shape' => $shape]);

    expect($html)->toContain('sir-skeleton--' . $shape, '--sir-skeleton-width: 48px;', '--sir-skeleton-height: 3rem;', 'custom', 'margin: 2px', 'data-loading="profile"', 'role="none"', 'aria-hidden="true"');
    expect($html)->not->toContain('role="status"', 'aria-hidden="false"', 'tabindex=');
})->with(['rounded', 'rectangle', 'circle']);

it('renders the primitives under a customized Blade namespace', function (): void {
    Blade::anonymousComponentPath(__DIR__ . '/../../resources/views/components', 'custom');
    $html = Blade::render('<x-custom::avatar /><x-custom::separator /><x-custom::skeleton />');

    expect($html)->toContain('sir-avatar', 'sir-separator', 'sir-skeleton', '<svg');
});

it('rejects unsupported presentation primitive contracts', function (string $template): void {
    expect(fn (): string => Blade::render($template))->toThrow(ViewException::class);
})->with([
    '<x-sirius::avatar :src="[]" />', '<x-sirius::avatar :alt="false" />', '<x-sirius::avatar :fallback="[]" />',
    '<x-sirius::avatar size="huge" />', '<x-sirius::avatar variant="square" />',
    '<x-sirius::separator orientation="diagonal" />', '<x-sirius::separator decorative="false" />',
    '<x-sirius::skeleton shape="triangle" />', '<x-sirius::skeleton width="1rem; color:red" />',
    '<x-sirius::skeleton :height="-10" />', '<x-sirius::skeleton :width="[]" />',
]);
