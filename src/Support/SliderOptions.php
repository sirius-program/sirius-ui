<?php

declare(strict_types=1);

namespace Sirius\Ui\Support;

use InvalidArgumentException;

final class SliderOptions
{
    /** @return array{range: bool, min: list<float>, max: list<float>, step: list<float>, value: list<float>} */
    public static function resolve(bool $range, mixed $min, mixed $max, mixed $step, mixed $value): array
    {
        $minimums = self::numbers($min, $range);
        $maximums = self::numbers($max, $range);
        $steps = self::numbers($step, $range);
        foreach ($minimums as $index => $minimum) {
            if ($maximums[$index] < $minimum || $steps[$index] <= 0 || $minimum + $steps[$index] === $minimum
                || ($maximums[$index] - $minimum) / $steps[$index] > 9007199254740991) {
                throw new InvalidArgumentException('Slider requires ordered finite bounds and a positive representable step.');
            }
        }
        $last = array_map(fn (float $min, float $max, float $step): float => $min + floor(($max - $min) / $step + 1e-9) * $step, $minimums, $maximums, $steps);
        if ($range && $minimums[0] > $last[1]) {
            throw new InvalidArgumentException('Slider constraints must allow an ordered pair.');
        }
        if ($value === null && !$range) {
            $value = $minimums[0];
        }
        $values = self::numbers($value, $range);
        foreach ($values as $index => $number) {
            $position = ($number - $minimums[$index]) / $steps[$index];
            if ($number < $minimums[$index] || $number > $maximums[$index] || abs($position - round($position)) > 1e-7) {
                throw new InvalidArgumentException('Slider value must be within bounds and on its step grid.');
            }
        }
        if ($range && $values[0] > $values[1]) {
            throw new InvalidArgumentException('Slider range values must be ordered.');
        }

        return ['range' => $range, 'min' => $minimums, 'max' => $maximums, 'step' => $steps, 'value' => $values];
    }

    /** @return list<float> */
    private static function numbers(mixed $value, bool $range): array
    {
        if ($range && (!is_array($value) || !array_is_list($value) || count($value) !== 2)) {
            throw new InvalidArgumentException('Range slider value, min, max and step must each contain exactly two numbers.');
        }
        $values = $range ? $value : [$value];
        $result = [];
        foreach ($values as $number) {
            if ((!is_int($number) && !is_float($number) && !is_string($number)) || !is_numeric($number) || !is_finite((float) $number) || abs((float) $number) > 9007199254740991) {
                throw new InvalidArgumentException('Slider requires finite numbers within JavaScript safe numeric bounds.');
            }
            $result[] = (float) $number;
        }

        return $result;
    }
}
