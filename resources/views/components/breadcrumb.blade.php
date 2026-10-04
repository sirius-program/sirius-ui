@props(['label' => null, 'separator' => '/', 'separatorIcon' => null])
@php
    $label ??= __('sirius::sirius-ui.breadcrumb.label');
    if (! is_string($label) || trim($label) === '' || ! is_string($separator)) {
        throw new \InvalidArgumentException('Breadcrumb label must be non-empty text and separator must be text.');
    }
@endphp
<nav {{ $attributes->except(['data-sir-breadcrumb'])->class(['sir-breadcrumb'])->merge(['aria-label' => $label]) }} data-sir-breadcrumb>
    <ol>{{ $slot }}</ol>
</nav>
