@props([
    'id' => null, 'label' => null, 'name' => null, 'helper' => null,
    'required' => false, 'disabled' => false, 'readonly' => false,
    'errorKey' => null, 'errorBag' => 'default', 'errors' => null,
    'size' => 'md', 'wrapperClass' => '', 'value' => null,
    'type' => 'date', 'displayFormat' => null, 'timezone' => null,
    'locale' => null, 'weekStart' => null, 'minuteIncrement' => null,
    'minDate' => null, 'maxDate' => null, 'minTime' => null, 'maxTime' => null,
    'disabledDates' => null, 'clearable' => null, 'options' => [],
])
@php
    $clearable ??= !$required;
    if (!in_array($type, ['date', 'time', 'datetime'], true)) {
        throw new InvalidArgumentException('Datetime picker type must be date, time, or datetime.');
    }
    if ($value !== null && !is_string($value)) {
        throw new InvalidArgumentException('Datetime picker values must be canonical strings or null.');
    }
    $timezone ??= config('sirius-ui.timezone') ?? config('app.timezone') ?? 'UTC';
    if (!is_string($timezone) || !in_array($timezone, DateTimeZone::listIdentifiers(DateTimeZone::ALL_WITH_BC), true)) {
        throw new InvalidArgumentException('Datetime picker timezone must be a valid IANA timezone.');
    }
    $allowedOptions = ['minDate', 'maxDate', 'minTime', 'maxTime', 'disable', 'locale', 'minuteIncrement', 'hourIncrement', 'time_24hr', 'weekNumbers', 'showMonths', 'monthSelectorType', 'position', 'shorthandCurrentMonth', 'ariaDateFormat', 'defaultHour', 'defaultMinute'];
    if (!is_array($options) || array_diff(array_keys($options), $allowedOptions) !== []) {
        throw new InvalidArgumentException('Unsupported datetime picker option; lifecycle, parsing, value, and selection options are managed internally.');
    }
    $settings = array_replace(['minuteIncrement' => 5, 'time_24hr' => true, 'locale' => config('sirius-ui.locale') ?? config('app.locale') ?? config('app.fallback_locale') ?? 'en'], $options, array_filter([
        'minDate' => $minDate, 'maxDate' => $maxDate, 'minTime' => $minTime, 'maxTime' => $maxTime,
        'disable' => $disabledDates, 'locale' => $locale, 'minuteIncrement' => $minuteIncrement,
    ], fn ($setting) => $setting !== null));
    $supportedLocales = ['ar', 'at', 'az', 'be', 'bg', 'bn', 'bs', 'ca', 'ckb', 'cat', 'cs', 'cy', 'da', 'de', 'default', 'en', 'eo', 'es', 'et', 'fa', 'fi', 'fo', 'fr', 'gr', 'he', 'hi', 'hr', 'hu', 'hy', 'id', 'is', 'it', 'ja', 'ka', 'ko', 'km', 'kz', 'lt', 'lv', 'mk', 'mn', 'ms', 'my', 'nl', 'nn', 'no', 'pa', 'pl', 'pt', 'ro', 'ru', 'si', 'sk', 'sl', 'sq', 'sr', 'sv', 'th', 'tr', 'uk', 'vn', 'zh', 'zh_tw', 'uz', 'uz_latn'];
    if (!is_string($settings['locale'])) {
        throw new InvalidArgumentException('Datetime picker locale must be a supported locale string.');
    }
    $resolvedLocale = strtolower(str_replace('-', '_', $settings['locale']));
    if (!in_array($resolvedLocale, $supportedLocales, true)) {
        $language = explode('_', $resolvedLocale)[0];
        $resolvedLocale = ['el' => 'gr', 'vi' => 'vn', 'nb' => 'no'][$language] ?? $language;
    }
    if (!in_array($resolvedLocale, $supportedLocales, true)) {
        throw new InvalidArgumentException('Datetime picker locale must have a bundled Flatpickr translation. Override sirius-ui.locale or the locale prop.');
    }
    $settings['locale'] = $resolvedLocale;
    if (filter_var($settings['minuteIncrement'], FILTER_VALIDATE_INT) === false || $settings['minuteIncrement'] < 1 || $settings['minuteIncrement'] > 60
        || ($weekStart !== null && (filter_var($weekStart, FILTER_VALIDATE_INT) === false || $weekStart < 0 || $weekStart > 6))) {
        throw new InvalidArgumentException('Minute increment must be 1–60; week start must be 0–6.');
    }
    foreach (['weekNumbers', 'time_24hr', 'shorthandCurrentMonth'] as $option) {
        if (isset($settings[$option]) && !is_bool($settings[$option])) {
            throw new InvalidArgumentException('Datetime picker boolean options must be booleans.');
        }
    }
    foreach (['hourIncrement' => [1, 24], 'showMonths' => [1, 12], 'defaultHour' => [0, 23], 'defaultMinute' => [0, 59]] as $option => [$lower, $upper]) {
        if (isset($settings[$option]) && (filter_var($settings[$option], FILTER_VALIDATE_INT) === false || $settings[$option] < $lower || $settings[$option] > $upper)) {
            throw new InvalidArgumentException('Datetime picker numeric option is outside its supported range.');
        }
    }
    if (isset($settings['monthSelectorType']) && !in_array($settings['monthSelectorType'], ['dropdown', 'static'], true)
        || isset($settings['position']) && (!is_string($settings['position']) || !preg_match('/^(auto|above|below)( (left|center|right))?$/D', $settings['position']))
        || isset($settings['ariaDateFormat']) && (!is_string($settings['ariaDateFormat']) || $settings['ariaDateFormat'] === '')) {
        throw new InvalidArgumentException('Invalid datetime picker presentation option.');
    }
    foreach (['minDate', 'maxDate', 'minTime', 'maxTime'] as $bound) {
        if (!isset($settings[$bound])) { continue; }
        $format = str_ends_with($bound, 'Time') ? 'H:i' : ($type === 'datetime' ? 'Y-m-d H:i:s' : 'Y-m-d');
        $date = is_string($settings[$bound]) ? DateTimeImmutable::createFromFormat('!'.$format, $settings[$bound], new DateTimeZone('UTC')) : false;
        if (!$date || $date->format($format) !== $settings[$bound]) {
            throw new InvalidArgumentException('Datetime picker bounds must use the documented canonical format.');
        }
    }
    if (($type === 'time' && (isset($settings['minDate']) || isset($settings['maxDate']) || isset($settings['disable'])))
        || ($type === 'date' && (isset($settings['minTime']) || isset($settings['maxTime'])))) {
        throw new InvalidArgumentException('Date/time bounds must match the picker type.');
    }
    foreach ([['minDate', 'maxDate'], ['minTime', 'maxTime']] as [$minimum, $maximum]) {
        if (isset($settings[$minimum], $settings[$maximum]) && $settings[$minimum] > $settings[$maximum]) {
            throw new InvalidArgumentException('Datetime picker minimum must not exceed maximum; overnight time ranges are unsupported.');
        }
    }
    if (isset($settings['disable'])) {
        if (!is_array($settings['disable']) || !array_is_list($settings['disable'])) {
            throw new InvalidArgumentException('Disabled dates must be a list of Y-m-d strings.');
        }
        foreach ($settings['disable'] as $day) {
            $date = is_string($day) ? DateTimeImmutable::createFromFormat('!Y-m-d', $day) : false;
            if (!$date || $date->format('Y-m-d') !== $day) {
                throw new InvalidArgumentException('Disabled dates must be valid Y-m-d strings.');
            }
        }
    }
    $canonicalFormat = ['date' => 'Y-m-d', 'time' => 'H:i', 'datetime' => 'Y-m-d H:i:s'][$type];
    $displayFormat ??= ['date' => 'd/m/Y', 'time' => 'H:i', 'datetime' => 'd/m/Y H:i:S'][$type];
    if (!is_string($displayFormat) || $displayFormat === '') {
        throw new InvalidArgumentException('Display format must be a non-empty Flatpickr format.');
    }
    $bindings = $attributes->filter(fn ($value, $key) => $key === 'wire:model' || str_starts_with($key, 'wire:model.') || $key === 'x-model' || str_starts_with($key, 'x-model.'));
    foreach (array_keys($bindings->getAttributes()) as $binding) {
        if (array_intersect(explode('.', $binding), ['number', 'boolean']) !== []) {
            throw new InvalidArgumentException('Datetime picker model bindings must preserve strings.');
        }
    }
@endphp
<x-sirius-internal-field :id="$id" :label="$label" :name="$name" :helper="$helper"
    :required="$required" :disabled="$disabled" :readonly="$readonly" :error-key="$errorKey"
    :error-bag="$errorBag" :errors="$errors" :size="$size" :wrapper-class="$wrapperClass"
    :attributes="$attributes->except(['type'])">
    <div data-sir-datetime-picker>
        <div class="sir-input-shell">
            <span class="sir-adornment" data-sir-date-prefix aria-hidden="true">
                @if ($type === 'time')
                    <x-heroicon-o-clock class="sir-icon" />
                @else
                    <x-heroicon-o-calendar-days class="sir-icon" />
                @endif
            </span>
        <input type="text" {{ $component->controlAttributes()->except(array_keys($bindings->getAttributes()))->merge(['value' => $value, 'autocomplete' => 'off']) }}
            data-sir-date-display data-sir-date-config="{{ json_encode(['type' => $type, 'format' => $displayFormat, 'canonical' => str_replace('s', 'S', $canonicalFormat), 'timezone' => $timezone, 'weekStart' => $weekStart, 'options' => $settings], JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES) }}"
            data-sir-server-invalid="{{ $component->messages() !== [] ? 'true' : 'false' }}">
        @if ($clearable)
            <button type="button" class="sir-adornment sir-date-clear" data-sir-date-clear hidden aria-label="Clear" title="Clear" @disabled($disabled || $readonly)><x-heroicon-o-x-mark aria-hidden="true" class="sir-icon" /></button>
        @endif
        </div>
        <input type="hidden" data-sir-date-value @if ($bindings->isNotEmpty()) wire:ignore @endif name="{{ $name }}" value="{{ $value }}" disabled
            @if ($attributes->has('form')) form="{{ $attributes->get('form') }}" @endif {{ $bindings }}>
    </div>
</x-sirius-internal-field>
