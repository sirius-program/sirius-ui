@props(['for' => null, 'required' => false, 'as' => 'label'])

@php
    if (! in_array($as, ['label', 'legend'], true)) {
        throw new \InvalidArgumentException('Label tag must be label or legend.');
    }
@endphp

<{{ $as }} @if ($as === 'label' && $for !== null) for="{{ $for }}" @endif {{ $attributes->class(['sir-label']) }}>
    {{ $slot }}@if ($required)<span class="sir-required" aria-hidden="true"> *</span>@endif
</{{ $as }}>
