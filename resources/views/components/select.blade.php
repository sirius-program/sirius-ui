@props([
    'id' => null, 'label' => null, 'name' => null, 'helper' => null,
    'required' => false, 'disabled' => false, 'readonly' => false,
    'errorKey' => null, 'errorBag' => 'default', 'errors' => null,
    'size' => 'md', 'wrapperClass' => '', 'value' => null,
    'options' => [], 'multiple' => false, 'placeholder' => null,
    'clearable' => null, 'searchable' => true, 'searchUrl' => null,
    'debounce' => 300, 'minSearchLength' => 0, 'maxItems' => null,
])
@php
    $messages = [];
    foreach (['placeholder', 'clear', 'retry', 'remove', 'load_more', 'loading', 'empty', 'error', 'labels_error', 'minimum'] as $key) {
        $messages[$key] = __('sirius::sirius-ui.select.'.$key);
    }
    $placeholder ??= $messages['placeholder'];
    $options = \Sirius\Ui\Support\SelectOptions::normalize($options);
    $values = \Sirius\Ui\Support\SelectOptions::values($value, (bool) $multiple);
    $clearable ??= !$required;
    if (!is_int($debounce) || $debounce < 0 || $debounce > 10000 || !is_int($minSearchLength) || $minSearchLength < 0 || $minSearchLength > 100) {
        throw new InvalidArgumentException('Select debounce and min-search-length must be bounded non-negative integers.');
    }
    if ($maxItems !== null && (!is_int($maxItems) || $maxItems < 1 || !$multiple)) {
        throw new InvalidArgumentException('Select max-items requires multiple mode and a positive integer.');
    }
    if ($searchUrl !== null && (!is_string($searchUrl) || $searchUrl === '' || !$searchable)) {
        throw new InvalidArgumentException('Select search-url requires a non-empty URL and searchable mode.');
    }
    $bindings = $attributes->filter(fn ($value, $key) => $key === 'wire:model' || str_starts_with($key, 'wire:model.') || $key === 'x-model' || str_starts_with($key, 'x-model.'));
    foreach (array_keys($bindings->getAttributes()) as $binding) {
        if (array_intersect(explode('.', $binding), ['number', 'boolean', 'trim']) !== []) {
            throw new InvalidArgumentException('Select bindings must preserve string IDs and arrays.');
        }
    }
    $submittedName = $multiple && $name !== null && !str_ends_with($name, '[]') ? $name.'[]' : $name;
    $config = ['multiple' => (bool) $multiple, 'placeholder' => $placeholder, 'clearable' => (bool) $clearable, 'searchable' => (bool) $searchable, 'url' => $searchUrl, 'debounce' => $debounce, 'minimum' => $minSearchLength, 'maxItems' => $maxItems, 'values' => $values, 'messages' => $messages];
@endphp
<x-sirius-internal-field :id="$id" :label="$label" :name="$submittedName" :helper="$helper"
    :required="$required" :disabled="$disabled" :readonly="$readonly" :error-key="$errorKey"
    :error-bag="$errorBag" :errors="$errors" :size="$size" :wrapper-class="$wrapperClass" :attributes="$attributes" :label-status="$searchUrl !== null ? '' : null">
    <div data-sir-select data-select-config="{{ json_encode($config, JSON_THROW_ON_ERROR) }}">
        <select data-select-source {{ $component->controlAttributes()->except(array_keys($bindings->getAttributes())) }} @if ($multiple) multiple @endif>
            @unless ($multiple)<option value="">{{ $placeholder }}</option>@endunless
            @foreach (collect($options)->groupBy('group') as $group => $items)
                @if ($group !== '')<optgroup label="{{ $group }}">@endif
                @foreach ($items as $option)
                    <option value="{{ $option['value'] }}" @disabled($option['disabled']) @selected(in_array($option['value'], $values, true))>{{ $option['label'] }}</option>
                @endforeach
                @if ($group !== '')</optgroup>@endif
            @endforeach
            @foreach (array_diff($values, array_column($options, 'value')) as $selected)
                <option value="{{ $selected }}" selected>{{ $selected }}</option>
            @endforeach
        </select>
        <span hidden data-select-model @if ($bindings->isNotEmpty()) wire:ignore @endif {{ $bindings }}></span>
        <div data-select-ui wire:ignore></div>
        <template data-select-icons><span data-select-icon="clear"><x-heroicon-o-x-mark aria-hidden="true" /></span><span data-select-icon="retry"><x-heroicon-o-arrow-path aria-hidden="true" /></span></template>
    </div>
</x-sirius-internal-field>
