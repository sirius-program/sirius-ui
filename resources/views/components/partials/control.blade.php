@aware(['choiceGroup' => null])
@props([
    'id' => null, 'label' => null, 'name' => null, 'helper' => null,
    'required' => false, 'disabled' => false, 'readonly' => false,
    'errorKey' => null, 'errorBag' => 'default', 'errors' => null,
    'size' => 'md', 'wrapperClass' => '', 'type' => 'text',
    'prefix' => null, 'suffix' => null, 'value' => null,
    'checked' => false, 'indeterminate' => false, 'resize' => 'vertical',
    'showLabel' => 'Show', 'hideLabel' => 'Hide',
    'richtext' => false, 'controlSize' => null,
])
@php
    $choice = in_array($kind, ['checkbox', 'radio', 'switch'], true);
    $groupContext = in_array($kind, ['checkbox', 'radio'], true) && is_callable($choiceGroup) ? $choiceGroup() : null;
    if ($groupContext !== null) {
        $errorKey = $groupContext['key'] ?? '';
        $errorBag = $groupContext['bag'];
        $errors = $groupContext['errors'];
        if ($kind === 'radio') {
            $required = $required || $groupContext['required'];
        }
        $attributes = $attributes->except(['aria-describedby'])->merge([
            'aria-describedby' => trim(($attributes->get('aria-describedby') ?? '').' '.($groupContext['description'] ?? '')),
        ]);
    }
    if ($kind === 'input' && !in_array($type, ['text', 'number', 'password'], true)) {
        throw new InvalidArgumentException('Input type must be text, number, or password.');
    }
    if ($kind === 'textarea' && (!in_array($resize, ['none', 'vertical', 'horizontal', 'both'], true) || $richtext)) {
        throw new InvalidArgumentException('Textarea resize must be none, vertical, horizontal, or both. Richtext is scheduled for Phase 7.');
    }
    if ($indeterminate && $kind !== 'checkbox') {
        throw new InvalidArgumentException('Only checkbox supports indeterminate.');
    }
    $nativeType = $kind === 'switch' ? 'checkbox' : ($choice ? $kind : $type);
    $controlAttributes = $attributes->except(['kind'])->class([$choice ? 'sir-choice' : '', 'sir-switch' => $kind === 'switch']);
    if ($controlSize !== null) {
        $controlAttributes = $controlAttributes->merge(['size' => $controlSize]);
    }
@endphp
<x-sirius-internal-field :id="$id" :label="$label" :name="$name" :helper="$helper"
    :required="$required" :disabled="$disabled" :readonly="$readonly"
    :error-key="$errorKey" :error-bag="$errorBag" :errors="$errors"
    :layout="$choice ? 'inline' : 'stacked'" :size="$size" :wrapper-class="$wrapperClass"
    :show-required-indicator="$groupContext === null" :show-errors="$groupContext === null"
    :attributes="$controlAttributes">
    @if ($kind === 'textarea')
        <textarea {{ $component->controlAttributes()->class('sir-resize-'.$resize) }}>{{ $value ?? $slot }}</textarea>
    @elseif ($choice)
        <input type="{{ $nativeType }}"
            {{ $component->controlAttributes()->except(['readonly', 'role', 'aria-checked'])->merge(['value' => $value ?? 'on']) }}
            @checked($checked) data-sir-choice
            @if ($readonly) data-sir-readonly aria-readonly="true" @endif
            @if ($kind === 'switch') role="switch" @endif
            @if ($kind === 'checkbox') data-sir-indeterminate="{{ $indeterminate ? 'true' : 'false' }}" @endif>
    @else
        <div class="sir-input-shell">
            @if ($prefix !== null && (string) $prefix !== '')<span class="sir-adornment">{{ $prefix }}</span>@endif
            <input type="{{ $type }}" {{ $component->controlAttributes()->merge(['value' => $value]) }}
                @if ($type === 'password') data-sir-password @endif>
            @if ($suffix !== null && (string) $suffix !== '')<span class="sir-adornment">{{ $suffix }}</span>@endif
            @if ($type === 'password')
                <button type="button" class="sir-password-toggle" data-sir-password-toggle="{{ $component->id }}"
                    data-show-label="{{ $showLabel }}" data-hide-label="{{ $hideLabel }}"
                    title="{{ $showLabel }}" aria-label="{{ $showLabel }}" aria-controls="{{ $component->id }}" aria-pressed="false" @disabled($disabled) hidden>
                    @svg('heroicon-o-eye', 'sir-icon sir-eye', ['aria-hidden' => 'true'])
                    @svg('heroicon-o-eye-slash', 'sir-icon sir-eye-slash', ['aria-hidden' => 'true'])
                </button>
            @endif
        </div>
    @endif
</x-sirius-internal-field>
