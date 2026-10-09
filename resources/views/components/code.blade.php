@props(['variant' => 'info', 'block' => false, 'text' => null])
@php
    if (! in_array($variant, ['primary', 'info', 'secondary', 'success', 'danger', 'warning'], true) || ! is_bool($block) || ($text !== null && ! is_string($text))) {
        throw new \InvalidArgumentException('Code requires a supported variant, a boolean block, and optional text.');
    }
@endphp
<code {{ $attributes->class(['sir-code', 'sir-code--block' => $block, 'sir-tone--'.$variant => ! $block]) }}>@if ($text !== null){{ $text }}@else{{ $slot }}@endif</code>
