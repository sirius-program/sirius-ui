@props([
    'id' => null, 'label' => null, 'name' => null, 'helper' => null,
    'required' => false, 'disabled' => false, 'readonly' => false,
    'errorKey' => null, 'errorBag' => 'default', 'errors' => null,
    'size' => 'md', 'wrapperClass' => '', 'value' => null,
    'range' => false, 'min' => 0, 'max' => 100, 'step' => 1,
])
@php
    $config = \Sirius\Ui\Support\SliderOptions::resolve($range, $min, $max, $step, $value);
    $config['messages'] = collect(['lower', 'upper', 'value', 'invalid'])->mapWithKeys(fn ($key) => [$key => __('sirius::sirius-ui.slider.'.$key)])->all();
    $bindings = $attributes->filter(fn ($value, $key) => $key === 'wire:model' || str_starts_with($key, 'wire:model.') || $key === 'x-model' || str_starts_with($key, 'x-model.'));
    foreach (array_keys($bindings->getAttributes()) as $binding) {
        if (array_intersect(explode('.', $binding), ['number', 'boolean', 'trim']) !== []) {
            throw new InvalidArgumentException('Slider bindings already supply numbers; coercion modifiers are not supported.');
        }
    }
@endphp
<x-sirius-internal-field :id="$id" :label="$label" :name="$name" :helper="$helper"
    :required="$required" :disabled="$disabled" :readonly="$readonly"
    :error-key="$errorKey" :error-bag="$errorBag" :errors="$errors"
    :size="$size" :wrapper-class="$wrapperClass" :attributes="$attributes">
    <div data-sir-slider data-slider-config="{{ json_encode($config, JSON_THROW_ON_ERROR) }}">
        @foreach ($config['value'] as $index => $number)
            <input type="number" data-slider-source="{{ $index }}"
                {{ $component->controlAttributes()->except([...array_keys($bindings->getAttributes()), 'id', 'name', 'type', 'value', 'min', 'max', 'step'])->merge([
                    'id' => $component->id.($index ? '-upper' : ''),
                    'name' => $name === null ? null : ($range ? preg_replace('/\[\]$/', '', $name).'[]' : $name),
                    'value' => $number, 'min' => $config['min'][$index], 'max' => $config['max'][$index], 'step' => $config['step'][$index],
                    'aria-label' => $range ? ($label ? $label.' — ' : '').$config['messages'][$index ? 'upper' : 'lower'] : null,
                ]) }}>
        @endforeach
        <span hidden data-slider-model wire:ignore {{ $bindings }}></span>
        <div data-slider-ui wire:ignore></div>
    </div>
</x-sirius-internal-field>
