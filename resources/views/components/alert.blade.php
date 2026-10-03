@props(['id' => null, 'text', 'title' => null, 'icon' => null, 'variant' => 'info', 'footer' => null, 'open' => false, 'size' => 'md', 'closable' => false, 'closeOnEscape' => true, 'closeOnBackdrop' => true, 'initialFocus' => null])
@php
    $id ??= \Illuminate\Support\Str::random(5);
    if (! in_array($variant, ['primary', 'info', 'success', 'danger', 'warning', 'secondary', 'ghost', 'outline'], true)) {
        throw new \InvalidArgumentException('Unsupported alert variant.');
    }
    if (! is_string($text) || trim($text) === '') {
        throw new \InvalidArgumentException('Alert text must be a nonempty string.');
    }
    if ($title !== null && (! is_string($title) || trim($title) === '')) {
        throw new \InvalidArgumentException('Alert title must be a nonempty string or null.');
    }
    if ($icon !== null && (! is_string($icon) || trim($icon) === '')) {
        throw new \InvalidArgumentException('Alert icon must be a registered Blade Icons name or null.');
    }
    if ($footer !== null && ! $footer instanceof \Illuminate\View\ComponentSlot) {
        throw new \InvalidArgumentException('Alert footer must be a named Blade slot.');
    }
    if ($slot->isNotEmpty()) {
        throw new \InvalidArgumentException('Alert accepts text and a footer slot, not a default content slot.');
    }
    $alertAttributes = $attributes->except(['header', 'body', 'header-class', 'body-class', 'footer-class', 'data-sir-alert'])->class(['sir-alert', 'sir-tone--'.$variant]);
    if (! $alertAttributes->has('aria-label') && ! $alertAttributes->has('aria-labelledby')) {
        $alertAttributes = $alertAttributes->merge(['aria-labelledby' => $id.($title !== null ? '-title' : '-text')]);
    }
    if ($title !== null && ! $alertAttributes->has('aria-describedby')) {
        $alertAttributes = $alertAttributes->merge(['aria-describedby' => $id.'-text']);
    }
@endphp
<x-sirius-internal-dialog :id="$id" :open="$open" :size="$size" :closable="$closable" :close-on-escape="$closeOnEscape" :close-on-backdrop="$closeOnBackdrop" :initial-focus="$initialFocus" :footer="$footer" :attributes="$alertAttributes" data-sir-alert>
    <div class="sir-alert-content">
        @if ($icon !== null)<x-sirius-internal-icon :name="$icon" class="sir-alert-icon" />@endif
        @if ($title !== null)<h2 id="{{ $id }}-title" class="sir-alert-title">{{ $title }}</h2>@endif
        <p id="{{ $id }}-text" class="sir-alert-text">{{ $text }}</p>
    </div>
</x-sirius-internal-dialog>
