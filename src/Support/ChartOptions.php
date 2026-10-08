<?php

declare(strict_types=1);

namespace Sirius\Ui\Support;

use InvalidArgumentException;

final class ChartOptions
{
    /** @param array<string, mixed> $data
     * @param  array<string, mixed>  $options
     * @return array{type: string, data: array<string, mixed>, options: array<string, mixed>, width: int|null, height: int, explicitHeight: bool}
     */
    public static function validate(string $type, array $data, array $options, ?int $width, ?int $height): array
    {
        self::type($type);
        self::serializable($data);
        self::serializable($options);
        RegionalSettings::options($options);
        if (!isset($data['datasets']) || !is_array($data['datasets']) || !array_is_list($data['datasets'])) {
            throw new InvalidArgumentException('Chart data requires a list of datasets.');
        }
        if (isset($data['labels']) && (!is_array($data['labels']) || !array_is_list($data['labels']))) {
            throw new InvalidArgumentException('Chart labels must be a list.');
        }
        foreach ($data['datasets'] as $dataset) {
            if (!is_array($dataset) || (isset($dataset['data']) && !is_array($dataset['data']))) {
                throw new InvalidArgumentException('Chart datasets must contain array data.');
            }
            if (isset($dataset['type'])) {
                if (!is_string($dataset['type'])) {
                    throw new InvalidArgumentException('Chart dataset types must be strings.');
                }
                self::type($dataset['type']);
            }
        }
        foreach ([$width, $height] as $size) {
            if ($size !== null && $size < 1) {
                throw new InvalidArgumentException('Chart dimensions must be positive integers.');
            }
        }

        $locale = config('sirius-ui.locale') ?? config('app.locale') ?? config('app.fallback_locale') ?? 'en';
        $defaults = ['responsive' => true, 'maintainAspectRatio' => false, 'animation' => ['duration' => 200]];
        if (is_string($locale) && $locale !== '') {
            $defaults['locale'] = str_replace('_', '-', $locale);
        }
        foreach ($options as $key => $value) {
            $defaults[$key] = is_array($value) && isset($defaults[$key]) && is_array($defaults[$key])
                ? array_replace_recursive($defaults[$key], $value) : $value;
        }
        $resolved = $defaults;
        RegionalSettings::options($resolved);
        if ($height !== null) {
            $resolved['maintainAspectRatio'] = false;
        }

        return ['type' => $type, 'data' => $data, 'options' => $resolved, 'width' => $width, 'height' => $height ?? 320, 'explicitHeight' => $height !== null];
    }

    private static function type(string $type): void
    {
        if (!preg_match('/^[a-zA-Z][a-zA-Z0-9_-]{0,99}$/D', $type)) {
            throw new InvalidArgumentException('Chart type must be a nonempty controller name.');
        }
    }

    private static function serializable(mixed $value, int $depth = 0): void
    {
        if ($depth > 32 || is_object($value) || is_resource($value) || (is_float($value) && !is_finite($value))) {
            throw new InvalidArgumentException('Chart configuration requires finite JSON values; use local JavaScript extensions for callbacks.');
        }
        if (is_array($value)) {
            foreach ($value as $key => $item) {
                if (in_array($key, ['__proto__', 'prototype', 'constructor'], true)) {
                    throw new InvalidArgumentException('Chart configuration cannot contain prototype keys.');
                }
                self::serializable($item, $depth + 1);
            }
        }
    }
}
