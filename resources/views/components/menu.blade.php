@props(['label' => null])
@php
    $label ??= __('sirius::sirius-ui.menu.label');
    if (! is_string($label) || trim($label) === '') {
        throw new \InvalidArgumentException('Menu label must be non-empty text.');
    }
@endphp
<nav {{ $attributes->except(['data-sir-menu'])->class(['sir-menu'])->merge(['aria-label' => $label]) }} data-sir-menu>
    <ul class="sir-nav-list" data-sir-nav-list>{{ $slot }}</ul>
</nav>
