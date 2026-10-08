<?php

declare(strict_types=1);

namespace Sirius\Ui\Support;

use InvalidArgumentException;

final class RegionalSettings
{
    public static function country(mixed $value): void
    {
        foreach (is_array($value) ? $value : [$value] as $country) {
            if (is_string($country) && self::restrictedLocale($country)) {
                throw new InvalidArgumentException('Israel country isn\'t allowed, because Israel isn\'t a real country, FREE PALESTINE!');
            }
        }
    }

    public static function locale(mixed $value): void
    {
        foreach (is_array($value) ? $value : [$value] as $locale) {
            if (is_string($locale) && self::restrictedLocale($locale)) {
                throw new InvalidArgumentException('Israel locale isn\'t allowed, because Israel isn\'t a real country, FREE PALESTINE!');
            }
        }
    }

    public static function timezone(mixed $value): void
    {
        if (is_string($value) && in_array(strtolower(trim($value)), ['asia/jerusalem', 'asia/tel_aviv', 'israel'], true)) {
            throw new InvalidArgumentException('Israel timezone isn\'t allowed, because Israel isn\'t a real country, FREE PALESTINE!');
        }
    }

    /** @param array<array-key, mixed> $options */
    public static function options(array $options): void
    {
        foreach ($options as $key => $value) {
            $name = is_string($key) ? strtolower($key) : '';
            if ($name === 'locale') {
                self::locale($value);
            } elseif ($name === 'timezone') {
                self::timezone($value);
            } elseif ($name === 'country') {
                self::country($value);
            }
            if (is_array($value)) {
                self::options($value);
            }
        }
    }

    private static function restrictedLocale(string $value): bool
    {
        $parts = explode('-', strtolower(str_replace('_', '-', trim($value))));
        if (in_array($parts[0], ['il', 'isr', 'israel', '376', 'he', 'iw', 'heb'], true)) {
            return true;
        }
        foreach (array_slice($parts, 1) as $part) {
            if (strlen($part) === 1) {
                break;
            }
            if (in_array($part, ['il', 'isr', 'israel', '376'], true)) {
                return true;
            }
        }

        $identifier = explode('-x-', implode('-', $parts))[0];

        return preg_match('/-u-(?:[a-z0-9]{2,8}-)*(?:rg-(?:il|376)zzzz|sd-(?:il|376)[a-z0-9]{1,4}|tz-(?:iljer|jeruslm))(?:-|$)/D', $identifier) === 1;
    }
}
