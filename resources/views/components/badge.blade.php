@props(['variant' => 'info', 'size' => 'md', 'icon' => null])
@php
    if (! in_array($variant, ['primary', 'info', 'success', 'danger', 'warning', 'secondary', 'ghost', 'outline'], true) || ! in_array($size, ['sm', 'md', 'lg'], true)) {
        throw new \InvalidArgumentException('Unsupported badge variant or size.');
    }
@endphp
<span {{ $attributes->class(['sir-badge', 'sir-tone--'.$variant, 'sir-size--'.$size]) }}>
    @if ($icon !== null)<x-sirius-internal-icon :name="$icon" size="sm" />@endif
    {{ $slot }}
</span>
