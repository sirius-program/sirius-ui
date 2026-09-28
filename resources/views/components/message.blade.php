@props(['id' => null, 'variant' => 'info', 'icon' => null, 'dismissible' => false, 'resetKey' => ''])
@php
    if (! in_array($variant, ['primary', 'info', 'success', 'danger', 'warning', 'secondary', 'ghost', 'outline'], true)) {
        throw new \InvalidArgumentException('Unsupported message variant.');
    }
    $id ??= \Illuminate\Support\Str::random(5);
    if (! is_string($id) || $id === '' || preg_match('/[\s"\'<>`=]/u', $id)) {
        throw new \InvalidArgumentException('Message requires an ID without whitespace or markup characters.');
    }
    $messageAttributes = $attributes->except(['data-sir-message', 'data-reset-key'])->class(['sir-message', 'sir-tone--'.$variant])->merge(['role' => $variant === 'danger' ? 'alert' : 'status', 'aria-atomic' => 'true']);
@endphp
<div id="{{ $id }}" {{ $messageAttributes }} data-sir-message data-reset-key="{{ $resetKey }}">
    @if ($icon !== null)<x-sirius-internal-icon :name="$icon" />@endif
    <div class="sir-message-content">{{ $slot }}</div>
    @if ($dismissible)
        <button type="button" class="sir-message-dismiss" data-sir-message-dismiss aria-label="{{ __('sirius::sirius-ui.message.dismiss') }}" aria-controls="{{ $id }}">
            <x-sirius-internal-icon name="heroicon-o-x-mark" size="sm" />
        </button>
    @endif
</div>
