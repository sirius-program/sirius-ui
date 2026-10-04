@props(['title', 'description' => null, 'state' => 'upcoming', 'icon' => null, 'number' => null, 'marker' => null])
@php
    if ((! is_string($title) && ! $title instanceof \Illuminate\View\ComponentSlot) || trim((string) $title) === '' || ($description !== null && ! is_string($description))) {
        throw new \InvalidArgumentException('Timeline items require a title and an optional text description.');
    }
    if (! in_array($state, ['completed', 'current', 'upcoming'], true) || ($icon !== null && ! is_string($icon)) || ($number !== null && (! is_int($number) || $number < 1))) {
        throw new \InvalidArgumentException('Unsupported Timeline state, icon, or positive integer number.');
    }
@endphp
<li {{ $attributes->except(['data-state', 'aria-current'])->class(['sir-timeline-item']) }} data-state="{{ $state }}" @if ($state === 'current') aria-current="step" @endif>
    <span class="sir-timeline-marker" aria-hidden="true">
        @if ($marker instanceof \Illuminate\View\ComponentSlot)
            {{ $marker }}
        @elseif ($icon !== null)
            <x-sirius-internal-icon :name="$icon" size="sm" />
        @elseif ($number !== null)
            {{ $number }}
        @elseif ($state === 'completed')
            <x-sirius-internal-icon name="heroicon-o-check" size="sm" />
        @else
            <span class="sir-timeline-dot"></span>
        @endif
    </span>
    <div class="sir-timeline-content">
        <div class="sir-timeline-title">{{ $title }}<span class="sr-only"> — {{ __('sirius::sirius-ui.timeline.'.$state) }}</span></div>
        @if ($description !== null)<p class="sir-timeline-description">{{ $description }}</p>@endif
        @if (! $slot->isEmpty())<div class="sir-timeline-extra">{{ $slot }}</div>@endif
    </div>
</li>
