@props(['label' => null])
@php
    $label ??= __('sirius::sirius-ui.timeline.label');
    if (! is_string($label) || trim($label) === '') {
        throw new \InvalidArgumentException('Timeline label must be non-empty text.');
    }
@endphp
<ol {{ $attributes->class(['sir-timeline'])->merge(['aria-label' => $label]) }}>{{ $slot }}</ol>
