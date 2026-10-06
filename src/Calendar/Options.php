<?php

declare(strict_types=1);

namespace Sirius\Ui\Calendar;

use DateTimeZone;
use InvalidArgumentException;

final class Options
{
    public const array OWNED = ['plugins', 'locales', 'theme', 'themeSystem', 'events', 'eventSources', 'initialEvents',
        'eventDataTransform', 'eventSourceSuccess', 'eventSourceFailure', 'eventChange', 'eventAdd', 'eventRemove',
        'eventReceive', 'dateClick', 'select', 'eventClick', 'eventDrop', 'eventResize', 'loading', 'datesSet',
        'resources', 'schedulerLicenseKey'];

    /** @param array<string, mixed> $settings
     * @return array<string, mixed>
     */
    public static function validate(array $settings): array
    {
        self::serializable($settings);
        foreach (self::OWNED as $key) {
            if (array_key_exists($key, $settings)) {
                throw new InvalidArgumentException('Calendar option is adapter-owned or unsupported: ' . $key);
            }
        }
        if (isset($settings['views'])) {
            if (!is_array($settings['views'])) {
                throw new InvalidArgumentException('Calendar views must contain option arrays.');
            }
            foreach ($settings['views'] as $view) {
                if (!is_array($view) || array_intersect(array_keys($view), self::OWNED) !== []) {
                    throw new InvalidArgumentException('Calendar view options cannot replace adapter-owned options.');
                }
            }
        }
        $timezone = $settings['timeZone'] ?? null;
        $locale = $settings['locale'] ?? null;
        if (!is_string($timezone) || !in_array($timezone, DateTimeZone::listIdentifiers(DateTimeZone::ALL_WITH_BC), true)) {
            throw new InvalidArgumentException('Calendar requires an IANA timezone.');
        }
        if (!is_string($locale) || $locale === '') {
            throw new InvalidArgumentException('Calendar requires a supported locale.');
        }
        $locale = strtolower(str_replace('_', '-', $locale));
        $locales = json_decode(file_get_contents(__DIR__ . '/../../resources/data/calendar-locales.json') ?: '[]', true, flags: JSON_THROW_ON_ERROR);
        if (!is_array($locales)) {
            throw new InvalidArgumentException('Calendar locale metadata is missing.');
        }
        if (!in_array($locale, $locales, true)) {
            $locale = explode('-', $locale)[0];
        }
        if (!in_array($locale, $locales, true)) {
            throw new InvalidArgumentException('Calendar locale has no bundled FullCalendar translation.');
        }
        $settings['locale'] = $locale;
        if (!in_array($settings['initialView'] ?? null, ['dayGridMonth', 'timeGridWeek', 'timeGridDay', 'listWeek'], true)) {
            throw new InvalidArgumentException('Calendar initialView must be a supported month, week, day, or agenda view.');
        }
        if (!is_string($settings['initialDate'] ?? null)) {
            throw new InvalidArgumentException('Calendar initialDate must be a date string.');
        }
        Dates::parse($settings['initialDate'], $timezone, strlen($settings['initialDate']) === 10);
        foreach (['selectable', 'editable', 'eventStartEditable', 'eventDurationEditable'] as $key) {
            if (isset($settings[$key]) && !is_bool($settings[$key])) {
                throw new InvalidArgumentException('Calendar ' . $key . ' must be boolean.');
            }
        }
        if (isset($settings['firstDay']) && (!is_int($settings['firstDay']) || $settings['firstDay'] < 0 || $settings['firstDay'] > 6)) {
            throw new InvalidArgumentException('Calendar firstDay must be between zero and six.');
        }

        return $settings;
    }

    public static function serializable(mixed $value, int $depth = 0): void
    {
        if ($depth > 15 || is_object($value) || is_resource($value) || (is_float($value) && !is_finite($value))) {
            throw new InvalidArgumentException('Calendar configuration and events require finite JSON values without objects or functions.');
        }
        if (is_array($value)) {
            foreach ($value as $item) {
                self::serializable($item, $depth + 1);
            }
        }
    }
}
