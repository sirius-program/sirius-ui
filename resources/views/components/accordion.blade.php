@props(['id' => null, 'trigger' => null, 'open' => false, 'transition' => false, 'triggerClass' => '', 'contentClass' => ''])
@php
    $id ??= \Illuminate\Support\Str::random(5);
    if (! is_string($id) || $id === '' || preg_match('/[\s"\'<>`=]/u', $id)) {
        throw new \InvalidArgumentException('Accordion requires an ID without whitespace or markup characters.');
    }
    if (! is_bool($open) || ! is_bool($transition)) {
        throw new \InvalidArgumentException('Accordion open and transition must be booleans.');
    }
    if (! is_string($trigger) && ! $trigger instanceof \Illuminate\View\ComponentSlot) {
        throw new \InvalidArgumentException('Accordion requires trigger text or a named trigger slot.');
    }
    if ($trigger instanceof \Illuminate\View\ComponentSlot ? $trigger->isEmpty() : trim($trigger) === '') {
        throw new \InvalidArgumentException('Accordion requires trigger text or a named trigger slot.');
    }
    $triggerAttributes = $trigger instanceof \Illuminate\View\ComponentSlot ? $trigger->attributes : new \Illuminate\View\ComponentAttributeBag;
@endphp
<details id="{{ $id }}" {{ $attributes->except(['data-sir-accordion', 'data-transition'])->class(['sir-accordion']) }} @if ($open) open @endif data-sir-accordion data-transition="{{ $transition ? 'true' : 'false' }}">
    <summary id="{{ $id }}-trigger" aria-controls="{{ $id }}-content" {{ $triggerAttributes->except(['id', 'aria-controls', 'aria-expanded'])->class(['sir-accordion-trigger', $triggerClass]) }}>
        <span>{{ $trigger }}</span><x-sirius-internal-icon name="heroicon-o-chevron-down" size="sm" class="sir-accordion-chevron" />
    </summary>
    <div id="{{ $id }}-content" class="sir-accordion-content {{ $contentClass }}">{{ $slot }}</div>
</details>
