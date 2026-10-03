@props(['orientation' => 'horizontal', 'decorative' => false])
@php
    if (! in_array($orientation, ['horizontal', 'vertical'], true) || ! is_bool($decorative)) {
        throw new \InvalidArgumentException('Separator requires horizontal or vertical orientation and a boolean decorative value.');
    }
    $separatorAttributes = $attributes->except(['role', 'aria-hidden', 'aria-orientation'])->class(['sir-separator', 'sir-separator--'.$orientation]);
    $separatorAttributes = $decorative
        ? $separatorAttributes->merge(['role' => 'none', 'aria-hidden' => 'true'])
        : $separatorAttributes->merge(['role' => 'separator', 'aria-orientation' => $orientation]);
@endphp
@if ($orientation === 'horizontal')
    <hr {{ $separatorAttributes }} />
@else
    <div {{ $separatorAttributes }}></div>
@endif
