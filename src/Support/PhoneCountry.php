<?php

declare(strict_types=1);

namespace Sirius\Ui\Support;

use InvalidArgumentException;

final class PhoneCountry
{
    /** @return array<string, array{code: string, name: string}> */
    public static function countries(): array
    {
        /** @var array<string, array{code: string, name: string}> $countries */
        $countries = json_decode((string) file_get_contents(__DIR__ . '/../../resources/data/phone-countries.json'), true, flags: JSON_THROW_ON_ERROR);

        return $countries;
    }

    public static function country(mixed $input): string
    {
        if (!is_string($input) || !preg_match('/^[a-z]{2,3}(?:[-_][a-z]{2})?$/iD', $input)) {
            throw new InvalidArgumentException('Phone country must be a supported country or regional locale.');
        }
        $parts = explode('-', str_replace('_', '-', $input));
        $country = strtoupper(count($parts) > 1 ? $parts[1] : $input);
        if (array_key_exists($country, self::countries())) {
            return $country;
        }
        $language = strtolower($input);
        $mapping = ['en' => 'US', 'ja' => 'JP', 'ko' => 'KR', 'zh' => 'CN', 'vi' => 'VN', 'uk' => 'UA', 'el' => 'GR', 'ar' => 'SA', 'he' => 'IL'];
        if (isset($mapping[$language])) {
            return $mapping[$language];
        }
        throw new InvalidArgumentException('Unsupported phone country; provide an explicit country code.');
    }

    /** @return array{countries: list<string>, initial: string} */
    public static function resolve(mixed $input = null): array
    {
        $defaults = [config('sirius-ui.phone_country'), config('sirius-ui.locale'), config('app.locale'), config('app.fallback_locale'), 'US'];
        $resolved = $input;
        foreach ($defaults as $default) {
            $resolved ??= $default;
        }
        if ($resolved === '*') {
            $initial = 'US';
            foreach ($defaults as $default) {
                if ($default !== null && $default !== '*') {
                    $initial = self::list($default)[0];
                    break;
                }
            }

            $metadata = self::countries();
            $countries = array_keys($metadata);
            usort($countries, fn (string $left, string $right): int => ((int) $metadata[$left]['code'] <=> (int) $metadata[$right]['code']) ?: strcmp($metadata[$left]['name'], $metadata[$right]['name']));

            return ['countries' => $countries, 'initial' => $initial];
        }
        $countries = self::list($resolved);

        return ['countries' => $countries, 'initial' => $countries[0]];
    }

    /** @return non-empty-list<string> */
    private static function list(mixed $input): array
    {
        $values = is_array($input) ? $input : [$input];
        if ($values === [] || !array_is_list($values)) {
            throw new InvalidArgumentException('Phone countries must be a non-empty list or a country string.');
        }

        return array_values(array_unique(array_map(self::country(...), $values)));
    }
}
