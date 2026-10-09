@props(['title' => null, 'icon' => null])
@php
    if (! is_string($title) || trim($title) === '') {
        throw new \InvalidArgumentException('Menu category requires a non-empty title.');
    }
    if ($icon !== null && (! is_string($icon) || trim($icon) === '')) {
        throw new \InvalidArgumentException('Menu category icon must be a non-empty icon name or null.');
    }
@endphp
<li {{ $attributes->class(['sir-menu-category']) }}>
    <h2 class="sir-menu-category-title">
        @if ($icon !== null)<x-sirius-internal-icon :name="$icon" size="sm" />@endif
        <span>{{ $title }}</span>
    </h2>
    <ul class="sir-nav-list" data-sir-nav-list>{{ $slot }}</ul>
</li>
