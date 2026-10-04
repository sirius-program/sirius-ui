@props(['id' => null, 'label' => null, 'trigger' => null, 'variant' => 'info', 'placement' => 'bottom', 'open' => false, 'wrapperClass' => ''])
@php
    if (! $trigger instanceof \Illuminate\View\ComponentSlot || $trigger->isEmpty()) {
        throw new \InvalidArgumentException('Popover requires a named trigger slot.');
    }
    if (! is_string($wrapperClass)) {
        throw new \InvalidArgumentException('Popover wrapper-class must be text.');
    }
    $panelAttributes = $attributes->only(['class']);
    $attributes = $attributes->except(['class'])->class([$wrapperClass]);
@endphp
<x-sirius-internal-floating kind="popover" :$id :$label :$variant :$placement :$open :panel-attributes="$panelAttributes" {{ $attributes }}>
    <x-slot:trigger>{{ $trigger }}</x-slot:trigger>
    {{ $slot }}
</x-sirius-internal-floating>
