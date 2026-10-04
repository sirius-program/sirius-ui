@props(['id' => null, 'trigger' => null, 'open' => false, 'align' => 'start'])
@php
    $id ??= \Illuminate\Support\Str::random(5);
    if (! is_string($id) || $id === '' || preg_match('/[\s"\'<>`=]/u', $id)) {
        throw new \InvalidArgumentException('Dropdown requires an ID without whitespace or markup characters.');
    }
    if (! is_bool($open) || ! in_array($align, ['start', 'end'], true)) {
        throw new \InvalidArgumentException('Dropdown open must be a boolean and align must be start or end.');
    }
    if ((! is_string($trigger) && ! $trigger instanceof \Illuminate\View\ComponentSlot) || trim((string) $trigger) === '') {
        throw new \InvalidArgumentException('Dropdown requires trigger text or a named trigger slot.');
    }
    $triggerAttributes = $trigger instanceof \Illuminate\View\ComponentSlot ? $trigger->attributes : new \Illuminate\View\ComponentAttributeBag;
@endphp
<div id="{{ $id }}" {{ $attributes->except(['data-sir-dropdown', 'data-initial-open', 'data-align'])->class(['sir-dropdown']) }} data-sir-dropdown data-initial-open="{{ $open ? 'true' : 'false' }}" data-align="{{ $align }}">
    <button id="{{ $id }}-trigger" {{ $triggerAttributes->except(['id', 'type', 'aria-haspopup', 'aria-expanded', 'aria-controls', 'data-sir-dropdown-trigger'])->class(['sir-dropdown-trigger']) }} type="button" data-sir-dropdown-trigger aria-haspopup="menu" aria-expanded="{{ $open ? 'true' : 'false' }}" aria-controls="{{ $id }}-menu">{{ $trigger }}<x-sirius-internal-icon name="heroicon-o-chevron-down" size="sm" /></button>
    <ul id="{{ $id }}-menu" class="sir-nav-list sir-dropdown-panel" data-sir-nav-list role="menu" aria-labelledby="{{ $id }}-trigger" hidden>{{ $slot }}</ul>
</div>
