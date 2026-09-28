@props(['as' => 'button', 'variant' => 'info', 'size' => 'md', 'icon' => null, 'loading' => false, 'disabled' => false])
@php
    if (! in_array($as, ['button', 'a'], true)) {
        throw new \InvalidArgumentException('Button as must be button or a.');
    }
    if (! in_array($variant, ['primary', 'info', 'success', 'danger', 'warning', 'secondary', 'ghost', 'outline', 'link'], true) || ! in_array($size, ['sm', 'md', 'lg'], true)) {
        throw new \InvalidArgumentException('Unsupported button variant or size.');
    }
    if ($slot->isEmpty() && trim((string) $attributes->get('aria-label', '')) === '' && trim((string) $attributes->get('aria-labelledby', '')) === '') {
        throw new \InvalidArgumentException('An icon-only button requires aria-label or aria-labelledby.');
    }
    $locked = $disabled || $loading;
    $buttonAttributes = $attributes->except(['aria-disabled', 'aria-busy', 'data-sir-button'])->class(['sir-button', 'sir-tone--'.$variant, 'sir-size--'.$size]);
    if ($as === 'button') {
        $buttonAttributes = $buttonAttributes->merge(['type' => 'button']);
    } else {
        $buttonAttributes = $buttonAttributes->except(['type']);
        if ($locked) {
            $buttonAttributes = $buttonAttributes->except(['href', 'tabindex'])->merge(['tabindex' => '-1', 'role' => 'link']);
        }
    }
@endphp
<{{ $as }} {{ $buttonAttributes }} data-sir-button aria-disabled="{{ $locked ? 'true' : 'false' }}" aria-busy="{{ $loading ? 'true' : 'false' }}" @if ($as === 'button' && $locked) disabled @endif>
    @if ($loading)<span class="sir-spinner" aria-hidden="true"></span>@elseif ($icon !== null)<x-sirius-internal-icon :name="$icon" :size="$size" />@endif
    {{ $slot }}
</{{ $as }}>
