@props([
    'id' => null, 'label' => null, 'name' => null, 'helper' => null,
    'required' => false, 'disabled' => false, 'readonly' => false,
    'errorKey' => null, 'errorBag' => 'default', 'errors' => null,
    'size' => 'md', 'wrapperClass' => '', 'value' => null,
    'country' => null, 'delimiter' => ' ', 'controlSize' => null,
    'draft' => null, 'draftName' => null, 'resetKey' => 0,
    'countryLabel' => 'Country calling code', 'invalidMessage' => 'Enter a valid phone number for an allowed country.',
])
@php
    $phoneCountry = \Sirius\Ui\Support\PhoneCountry::resolve($country);
    $phoneCountries = \Sirius\Ui\Support\PhoneCountry::countries();
    if (!in_array($delimiter, [' ', '-', '.', ''], true)) {
        throw new InvalidArgumentException('Phone delimiter must be a space, hyphen, period, or empty string.');
    }
    if ($value !== null && (!is_string($value) || ($value !== '' && !preg_match('/^\+[1-9][0-9]{1,14}$/D', $value)))) {
        throw new InvalidArgumentException('Phone values must be E.164 strings or null.');
    }
    if ($draft !== null && (!is_array($draft) || !isset($draft['text'], $draft['country']) || !is_string($draft['text']) || !is_string($draft['country']) || !in_array($draft['country'], $phoneCountry['countries'], true))) {
        throw new InvalidArgumentException('Phone draft must contain text and an allowed country.');
    }
    if ($draftName !== null && (!is_string($draftName) || $draftName === '' || $draftName === $name)) {
        throw new InvalidArgumentException('Phone draft-name must differ from the canonical field name.');
    }
    $bindings = $attributes->filter(fn ($value, $key) => $key === 'wire:model' || str_starts_with($key, 'wire:model.') || $key === 'x-model' || str_starts_with($key, 'x-model.'));
    foreach (array_keys($bindings->getAttributes()) as $binding) {
        if (array_intersect(explode('.', $binding), ['number', 'boolean', 'trim']) !== []) {
            throw new InvalidArgumentException('Phone model bindings must preserve nullable E.164 strings.');
        }
    }
    $controlAttributes = $attributes->except(['type']);
    if ($controlSize !== null) { $controlAttributes = $controlAttributes->merge(['size' => $controlSize]); }
@endphp
<x-sirius-internal-field :id="$id" :label="$label" :name="$name" :helper="$helper"
    :required="$required" :disabled="$disabled" :readonly="$readonly" :error-key="$errorKey"
    :error-bag="$errorBag" :errors="$errors" :size="$size" :wrapper-class="$wrapperClass" :attributes="$controlAttributes">
    <div data-sir-phone data-phone-config="{{ json_encode($phoneCountry + ['delimiter' => $delimiter, 'draft' => $draft, 'reset' => $resetKey, 'disabled' => (bool) $disabled, 'invalidMessage' => $invalidMessage], JSON_THROW_ON_ERROR) }}">
        <div class="sir-input-shell">
            @if (count($phoneCountry['countries']) > 1)
                <select class="sir-adornment sir-phone-country" data-phone-country aria-label="{{ $countryLabel }}" aria-controls="{{ $component->id }}" @disabled($disabled || $readonly)>
                    @foreach ($phoneCountry['countries'] as $country)
                        <option value="{{ $country }}" @selected($country === $phoneCountry['initial'])>+{{ $phoneCountries[$country]['code'] }} - {{ $phoneCountries[$country]['name'] }}</option>
                    @endforeach
                </select>
            @else
                <span class="sir-adornment" data-phone-prefix aria-label="{{ $countryLabel }}">+{{ $phoneCountries[$phoneCountry['initial']]['code'] }}</span>
            @endif
            <input type="tel" {{ $component->controlAttributes()->except(['name', ...array_keys($bindings->getAttributes())])->merge(['inputmode' => 'tel', 'autocomplete' => 'tel-national']) }}
                data-sir-phone-display data-sir-server-invalid="{{ $component->messages() !== [] ? 'true' : 'false' }}" value="{{ $draft['text'] ?? $value }}">
        </div>
        <input type="hidden" data-sir-phone-value name="{{ $name }}" value="{{ $value }}" disabled @if ($attributes->has('form')) form="{{ $attributes->get('form') }}" @endif>
        <span hidden data-sir-phone-model data-initial="{{ $value }}" @if ($bindings->isNotEmpty()) wire:ignore @endif {{ $bindings }}></span>
        @if ($draftName !== null)
            <input type="hidden" data-phone-draft name="{{ $draftName }}" disabled @if ($attributes->has('form')) form="{{ $attributes->get('form') }}" @endif>
        @endif
        <p class="sir-error" data-phone-error id="{{ $component->id }}-phone-error" aria-live="polite" hidden></p>
        <noscript><p class="sir-helper">JavaScript is required to submit this phone field in international format.</p></noscript>
    </div>
</x-sirius-internal-field>
