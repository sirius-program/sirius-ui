<?php

declare(strict_types=1);

namespace Sirius\Ui\Support;

use InvalidArgumentException;

final class SelectOptions
{
    /** @return list<array{value: string, label: string, disabled: bool, group: string}> */
    public static function normalize(mixed $options): array
    {
        if (!is_array($options) || !array_is_list($options)) {
            throw new InvalidArgumentException('Select options must be a list of value/label records.');
        }
        $result = [];
        $seen = [];
        foreach ($options as $option) {
            if (!is_array($option) || !isset($option['value'], $option['label']) || (!is_string($option['value']) && !is_int($option['value'])) || (string) $option['value'] === '' || !is_string($option['label']) || (isset($option['disabled']) && !is_bool($option['disabled'])) || (isset($option['group']) && !is_string($option['group']))) {
                throw new InvalidArgumentException('Select options require a non-empty string/integer value and a string label; disabled is boolean and group is a string.');
            }
            $value = (string) $option['value'];
            if (in_array($value, $seen, true)) {
                throw new InvalidArgumentException('Select option values must be unique.');
            }
            $seen[] = $value;
            $result[] = ['value' => $value, 'label' => $option['label'], 'disabled' => $option['disabled'] ?? false, 'group' => $option['group'] ?? ''];
        }

        return $result;
    }

    /** @return list<string> */
    public static function values(mixed $value, bool $multiple): array
    {
        if ($value === null || $value === '') {
            return [];
        }
        if (($multiple && (!is_array($value) || !array_is_list($value))) || (!$multiple && !is_string($value) && !is_int($value))) {
            throw new InvalidArgumentException('Select values must be a scalar string/integer, or a list in multiple mode.');
        }
        $values = $multiple ? $value : [$value];
        $result = [];
        foreach ($values as $item) {
            if ((!is_string($item) && !is_int($item)) || (string) $item === '') {
                throw new InvalidArgumentException('Select IDs must be non-empty strings or integers.');
            }
            $result[] = (string) $item;
        }

        return array_values(array_unique($result));
    }
}
