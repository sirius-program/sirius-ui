@props(['label' => null])
@php
    if (($label === null || trim($label) === '') && ! $attributes->has('aria-label') && ! $attributes->has('aria-labelledby')) {
        throw new \InvalidArgumentException('Button group requires label, aria-label, or aria-labelledby.');
    }
@endphp
<div {{ $attributes->except('role')->class(['sir-button-group'])->merge(['aria-label' => $label]) }} role="group">{{ $slot }}</div>
