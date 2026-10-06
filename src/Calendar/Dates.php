<?php

declare(strict_types=1);

namespace Sirius\Ui\Calendar;

use Carbon\CarbonImmutable;
use DateTimeImmutable;
use DateTimeZone;
use InvalidArgumentException;

final class Dates
{
    public static function parse(string $value, string $timezone, bool $allDay = false): CarbonImmutable
    {
        $pattern = $allDay
            ? '/^\d{4}-\d{2}-\d{2}$/D'
            : '/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/D';
        if (!preg_match($pattern, $value) || str_starts_with($value, '0000')) {
            throw new InvalidArgumentException('Calendar dates must be date-only for all-day values or ISO-8601 with an explicit offset for timed values.');
        }
        $format = $allDay ? '!Y-m-d' : (str_contains($value, '.') ? '!Y-m-d\TH:i:s.uP' : '!Y-m-d\TH:i:sP');
        $parsed = DateTimeImmutable::createFromFormat($format, $value, new DateTimeZone($timezone));
        $errors = DateTimeImmutable::getLastErrors();
        if ($parsed === false || ($errors !== false && ($errors['warning_count'] > 0 || $errors['error_count'] > 0))) {
            throw new InvalidArgumentException('Calendar date is invalid.');
        }

        return CarbonImmutable::instance($parsed)->setTimezone($timezone);
    }

    /** @param array<array-key, mixed> $input
     * @return array{start: string, end: ?string, allDay: bool}
     */
    public static function span(array $input, string $timezone, bool $requireEnd = false): array
    {
        if (!is_string($input['start'] ?? null) || !is_bool($input['allDay'] ?? null)
            || (isset($input['end']) && !is_string($input['end'])) || ($requireEnd && !is_string($input['end'] ?? null))) {
            throw new InvalidArgumentException('Calendar interactions require a start, allDay boolean, and an optional exclusive end.');
        }
        $start = self::parse($input['start'], $timezone, $input['allDay']);
        $end = isset($input['end']) ? self::parse($input['end'], $timezone, $input['allDay']) : null;
        if ($end instanceof CarbonImmutable && $end <= $start) {
            throw new InvalidArgumentException('Calendar end must be after start.');
        }

        return ['start' => self::canonical($start, $input['allDay']),
            'end'       => $end instanceof CarbonImmutable ? self::canonical($end, $input['allDay']) : null,
            'allDay'    => $input['allDay']];
    }

    private static function canonical(CarbonImmutable $date, bool $allDay): string
    {
        if ($allDay) {
            return $date->toDateString();
        }

        return $date->microsecond === 0 ? $date->toIso8601String() : $date->format('Y-m-d\TH:i:s.uP');
    }

    /** @param array<string, mixed> $event */
    public static function recurrence(array $event, string $timezone): void
    {
        if (isset($event['daysOfWeek'])) {
            if (!is_array($event['daysOfWeek']) || !array_is_list($event['daysOfWeek']) || count($event['daysOfWeek']) > 7) {
                throw new InvalidArgumentException('Calendar daysOfWeek must be a list of weekdays.');
            }
            foreach ($event['daysOfWeek'] as $day) {
                if (!is_int($day) || $day < 0 || $day > 6) {
                    throw new InvalidArgumentException('Calendar weekdays must be integers from zero to six.');
                }
            }
        }
        foreach (['startTime', 'endTime'] as $key) {
            if (isset($event[$key]) && (!is_string($event[$key]) || !preg_match('/^\d{2}:[0-5]\d(?::[0-5]\d)?$/D', $event[$key]))) {
                throw new InvalidArgumentException('Calendar recurrence times must use HH:mm or HH:mm:ss.');
            }
        }
        foreach (['startRecur', 'endRecur'] as $key) {
            if (isset($event[$key])) {
                if (!is_string($event[$key])) {
                    throw new InvalidArgumentException('Calendar recurrence bounds must be date strings.');
                }
                self::parse($event[$key], $timezone, true);
            }
        }
        if (isset($event['startRecur'], $event['endRecur']) && $event['endRecur'] <= $event['startRecur']) {
            throw new InvalidArgumentException('Calendar recurrence end must be after start.');
        }
    }
}
