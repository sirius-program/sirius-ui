@props([
    'id' => null, 'label' => null, 'name' => null, 'helper' => null,
    'required' => false, 'disabled' => false, 'readonly' => false,
    'errorKey' => null, 'errorBag' => 'default', 'errors' => null,
    'size' => 'md', 'wrapperClass' => '', 'value' => null,
    'prefix' => null, 'suffix' => null, 'controlSize' => null,
    'thousandsSeparator' => null, 'decimalSeparator' => null,
    'precision' => null, 'allowNegative' => false,
])
@php
    $thousandsSeparator ??= config('sirius-ui.currency.thousands_separator') ?? ',';
    $decimalSeparator ??= config('sirius-ui.currency.decimal_separator') ?? '.';
    $precision ??= config('sirius-ui.currency.precision') ?? 2;
    if (!in_array($thousandsSeparator, [',', '.', ' ', "'"], true)
        || !in_array($decimalSeparator, ['.', ','], true) || $thousandsSeparator === $decimalSeparator) {
        throw new InvalidArgumentException('Currency requires distinct supported thousands and decimal separators.');
    }
    if (filter_var($precision, FILTER_VALIDATE_INT) === false || (int) $precision < 0 || (int) $precision > 20) {
        throw new InvalidArgumentException('Currency precision must be an integer between 0 and 20.');
    }
    if ($value !== null && !is_string($value) && !is_int($value)) {
        throw new InvalidArgumentException('Currency values must be canonical decimal strings, integers, or null; do not use floats.');
    }
    foreach (['min', 'max'] as $limit) {
        $bound = $attributes->get($limit);
        if ($bound !== null && (!is_string($bound) && !is_int($bound) || !preg_match('/^-?[0-9]+(?:\.[0-9]+)?$/D', (string) $bound))) {
            throw new InvalidArgumentException('Currency min/max must be canonical decimal strings or integers.');
        }
    }
    $bindings = $attributes->filter(fn ($value, $key) => $key === 'wire:model' || str_starts_with($key, 'wire:model.') || $key === 'x-model' || str_starts_with($key, 'x-model.'));
    foreach (array_keys($bindings->getAttributes()) as $binding) {
        if (array_intersect(explode('.', $binding), ['number', 'boolean']) !== []) {
            throw new InvalidArgumentException('Currency bindings must preserve decimal strings; number/boolean modifiers are unsupported.');
        }
    }
    $controlAttributes = $attributes->except(['type']);
    if ($controlSize !== null) {
        $controlAttributes = $controlAttributes->merge(['size' => $controlSize]);
    }
@endphp
<x-sirius-internal-field :id="$id" :label="$label" :name="$name" :helper="$helper"
    :required="$required" :disabled="$disabled" :readonly="$readonly"
    :error-key="$errorKey" :error-bag="$errorBag" :errors="$errors"
    :size="$size" :wrapper-class="$wrapperClass" :attributes="$controlAttributes">
    <div class="sir-input-shell" data-sir-currency>
        @if ($prefix !== null && (string) $prefix !== '')<span class="sir-adornment">{{ $prefix }}</span>@endif
        <input type="text" {{ $component->controlAttributes()->except(array_keys($bindings->getAttributes()))->merge(['inputmode' => 'decimal', 'value' => $value]) }}
            data-sir-currency-display data-thousands="{{ $thousandsSeparator }}" data-decimal="{{ $decimalSeparator }}"
            data-precision="{{ (int) $precision }}" data-negative="{{ $allowNegative ? 'true' : 'false' }}"
            data-sir-server-invalid="{{ $component->messages() !== [] ? 'true' : 'false' }}">
        <input type="hidden" data-sir-currency-value @if ($bindings->isNotEmpty()) wire:ignore @endif name="{{ $name }}" value="{{ $value }}" disabled
            @if ($attributes->has('form')) form="{{ $attributes->get('form') }}" @endif
            {{ $bindings }}>
        @if ($suffix !== null && (string) $suffix !== '')<span class="sir-adornment">{{ $suffix }}</span>@endif
    </div>
</x-sirius-internal-field>
