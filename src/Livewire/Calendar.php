<?php

declare(strict_types=1);

namespace Sirius\Ui\Livewire;

use Carbon\CarbonImmutable;
use Illuminate\Support\Str;
use Illuminate\View\View;
use InvalidArgumentException;
use Livewire\Attributes\Locked;
use Livewire\Attributes\On;
use Livewire\Attributes\Renderless;
use Livewire\Component;
use Sirius\Ui\Calendar\Dates;
use Sirius\Ui\Calendar\Options;
use Sirius\Ui\Support\RegionalSettings;

abstract class Calendar extends Component
{
    #[Locked]
    public string $calendarId;

    #[Locked]
    public string $label;

    /** @var array<string, mixed> */
    #[Locked]
    public array $settings = [];

    /** @var array{start: string, end: string}|null */
    #[Locked]
    public ?array $visibleRange = null;

    #[Locked]
    public int $revision = 0;

    /** @return iterable<array<string, mixed>> */
    abstract protected function events(CarbonImmutable $start, CarbonImmutable $end, string $timezone): iterable;

    /** @param array<string, mixed> $context */
    protected function onDateClick(array $context): void
    {
        $this->dispatch('calendar:date-click', ...$context);
    }

    /** @param array<string, mixed> $context */
    protected function onSelect(array $context): void
    {
        $this->dispatch('calendar:select', ...$context);
    }

    /** @param array<string, mixed> $context */
    protected function onEventClick(array $context): void
    {
        $this->dispatch('calendar:event-click', ...$context);
    }

    /** @param array<string, mixed> $context */
    protected function onEventDrop(array $context): bool
    {
        return false;
    }

    /** @param array<string, mixed> $context */
    protected function onEventResize(array $context): bool
    {
        return false;
    }

    protected function recurringEditable(): bool
    {
        return false;
    }

    /** @param array<string, mixed> $options */
    public function mount(?string $id = null, ?string $label = null, ?string $initialView = null, ?string $initialDate = null,
        ?string $locale = null, ?string $timezone = null, ?int $firstDay = null, ?bool $selectable = null, ?bool $editable = null, array $options = []): void
    {
        $this->calendarId = $id ?? Str::random(5);
        $this->label = $label ?? __('sirius::sirius-ui.calendar.label');
        if (!preg_match('/^[a-zA-Z0-9_-]+$/D', $this->calendarId) || $this->label === '') {
            throw new InvalidArgumentException('Calendar requires a safe ID and a nonempty accessible label.');
        }
        $resolvedTimezone = $timezone ?? $options['timeZone'] ?? config('sirius-ui.timezone') ?? config('app.timezone') ?? 'UTC';
        RegionalSettings::locale($locale);
        RegionalSettings::locale($options['locale'] ?? null);
        RegionalSettings::timezone($timezone);
        RegionalSettings::timezone($options['timeZone'] ?? null);
        RegionalSettings::timezone($resolvedTimezone);
        if (!is_string($resolvedTimezone)) {
            throw new InvalidArgumentException('Calendar timezone must be a string.');
        }
        $this->settings = Options::validate(array_replace([
            'initialView'           => 'dayGridMonth', 'initialDate' => CarbonImmutable::now($resolvedTimezone)->toDateString(),
            'locale'                => config('sirius-ui.locale') ?? config('app.locale') ?? config('app.fallback_locale') ?? 'en',
            'timeZone'              => $resolvedTimezone, 'editable' => false, 'selectable' => false, 'height' => 'auto',
            'toolbarClass'          => 'sir-calendar-toolbar', 'lazyFetching' => false,
            'dayHeaderDividerClass' => 'sir-calendar-day-header-divider',
            'headerToolbar'         => ['left' => 'prev,next today', 'center' => 'title', 'right' => 'dayGridMonth,timeGridWeek,timeGridDay,listWeek'],
        ], $options, array_filter([
            'initialView' => $initialView,
            'initialDate' => $initialDate,
            'locale'      => $locale,
            'timeZone'    => $timezone,
            'firstDay'    => $firstDay,
            'selectable'  => $selectable,
            'editable'    => $editable,
        ], static fn (mixed $value): bool => $value !== null)));
    }

    /** @param array<string, mixed> $options */
    protected function configure(array $options): void
    {
        $this->settings = Options::validate(array_replace($this->settings, $options));
        $this->visibleRange = null;
        $this->refreshCalendar();
    }

    #[On('calendar:refresh.{calendarId}')]
    public function refreshCalendar(): void
    {
        $this->revision++;
    }

    /** @return list<array<string, mixed>> */
    #[Renderless]
    public function fetchEvents(string $start, string $end): array
    {
        [$from, $until] = $this->dateRange($start, $end);
        $this->visibleRange = ['start' => $from->toIso8601String(), 'end' => $until->toIso8601String()];

        return $this->eventData($from, $until);
    }

    /** @param array<string, mixed> $payload */
    #[Renderless]
    public function interact(string $action, array $payload): bool
    {
        try {
            return $this->handleInteraction($action, $payload);
        } catch (InvalidArgumentException $exception) {
            abort(422, $exception->getMessage());
        }
    }

    /** @param array<string, mixed> $payload */
    private function handleInteraction(string $action, array $payload): bool
    {
        abort_unless(in_array($action, ['date-click', 'select', 'event-click', 'event-drop', 'event-resize'], true), 422);
        $range = $payload['range'] ?? $this->visibleRange;
        abort_unless(is_array($range) && is_string($range['start'] ?? null) && is_string($range['end'] ?? null), 422);
        [$from, $until] = $this->dateRange($range['start'], $range['end']);
        $context = ['id' => $this->calendarId, 'timezone' => $this->timezone()];
        if ($action === 'date-click' || $action === 'select') {
            abort_unless($action !== 'select' || $this->settings['selectable'] === true, 422);
            $span = Dates::span($payload, $this->timezone(), $action === 'select');
            $value = Dates::parse($span['start'], $this->timezone(), $span['allDay']);
            abort_unless($value >= $from && $value < $until, 422);
            $context += $span;
            if ($action === 'date-click') {
                $this->onDateClick($context);
            } else {
                $this->onSelect($context);
            }

            return true;
        }
        $id = $payload['eventId'] ?? null;
        abort_unless(is_string($id) && $id !== '' && strlen($id) <= 200, 422);
        $records = $this->eventData($from, $until);
        $record = null;
        foreach ($records as $item) {
            if ($item['id'] === $id) {
                $record = $item;
                break;
            }
        }
        abort_unless($record !== null, 404);
        $context += ['eventId' => $id, 'record' => $record];
        if ($action === 'event-click') {
            $clicked = $payload['occurrence'] ?? $record;
            abort_unless(is_array($clicked), 422);
            $occurrence = Dates::span($clicked, $this->timezone());
            $occurrenceStart = Dates::parse($occurrence['start'], $this->timezone(), $occurrence['allDay']);
            $occurrenceEnd = $occurrence['end'] === null ? $occurrenceStart->addDay() : Dates::parse($occurrence['end'], $this->timezone(), $occurrence['allDay']);
            abort_unless($occurrenceStart < $until && $occurrenceEnd > $from, 422);
            if (isset($record['start'])) {
                $expected = Dates::span($record, $this->timezone());
                abort_unless($occurrence['start'] === $expected['start'] && $occurrence['allDay'] === $expected['allDay'], 422);
            }
            $context['occurrence'] = $occurrence;
            $this->onEventClick($context);

            return true;
        }
        $editingKey = $action === 'event-drop' ? 'startEditable' : 'durationEditable';
        $globalKey = $action === 'event-drop' ? 'eventStartEditable' : 'eventDurationEditable';
        abort_unless(($record[$editingKey] ?? $record['editable'] ?? $this->settings[$globalKey] ?? $this->settings['editable']) === true, 403);
        abort_unless(is_array($payload['new'] ?? null) && is_array($payload['old'] ?? null), 422);
        $new = Dates::span($payload['new'], $this->timezone());
        $old = Dates::span($payload['old'], $this->timezone());
        if (isset($record['start'])) {
            $expected = Dates::span($record, $this->timezone());
            abort_unless($old['start'] === $expected['start'] && $old['allDay'] === $expected['allDay']
                && ($expected['end'] === null || $old['end'] === $expected['end']), 409);
            $old = $expected;
        }
        $related = $payload['relatedIds'] ?? [];
        abort_unless(is_array($related) && array_is_list($related) && count($related) <= 500, 422);
        foreach ($related as $relatedId) {
            abort_unless(is_string($relatedId) && in_array($relatedId, array_column($records, 'id'), true), 404);
        }
        $context += ['old' => $old, 'new' => $new, 'relatedIds' => array_values(array_unique($related))];

        return $action === 'event-drop' ? $this->onEventDrop($context) : $this->onEventResize($context);
    }

    public function render(): View
    {
        return view('sirius::livewire.calendar');
    }

    protected function timezone(): string
    {
        $timezone = $this->settings['timeZone'] ?? null;
        if (!is_string($timezone)) {
            throw new InvalidArgumentException('Calendar timezone is missing.');
        }

        return $timezone;
    }

    /** @return array{CarbonImmutable, CarbonImmutable} */
    private function dateRange(string $start, string $end): array
    {
        try {
            $from = Dates::parse($start, $this->timezone());
            $until = Dates::parse($end, $this->timezone());
        } catch (InvalidArgumentException $exception) {
            abort(422, $exception->getMessage());
        }
        abort_unless($until > $from && $from->diffInDays($until) <= 370, 422);

        return [$from, $until];
    }

    /** @return list<array<string, mixed>> */
    private function eventData(CarbonImmutable $start, CarbonImmutable $end): array
    {
        $result = [];
        $ids = [];
        foreach ($this->events($start, $end, $this->timezone()) as $event) {
            Options::serializable($event);
            if (array_key_exists('rrule', $event)) {
                throw new InvalidArgumentException('Calendar RRule recurrence is not bundled.');
            }
            $id = $event['id'] ?? null;
            if ((!is_string($id) && !is_int($id)) || (string) $id === '' || strlen((string) $id) > 200 || in_array((string) $id, $ids, true)
                || !is_string($event['title'] ?? null)) {
                throw new InvalidArgumentException('Calendar events require unique string/integer IDs and string titles.');
            }
            $event['id'] = (string) $id;
            $ids[] = $event['id'];
            if (isset($event['url']) && (!is_string($event['url']) || !preg_match('~^(?:https?://|/[^/]|#)~i', $event['url']))) {
                throw new InvalidArgumentException('Calendar event URL must be HTTP(S), a local path, or a fragment.');
            }
            foreach (['allDay', 'editable', 'startEditable', 'durationEditable'] as $key) {
                if (isset($event[$key]) && !is_bool($event[$key])) {
                    throw new InvalidArgumentException('Calendar event editability must be boolean.');
                }
            }
            if (isset($event['start'])) {
                $event['allDay'] ??= is_string($event['start']) && strlen($event['start']) === 10;
                $event = array_replace($event, Dates::span($event, $this->timezone()));
            } else {
                if (!isset($event['daysOfWeek']) && !isset($event['startTime'])) {
                    throw new InvalidArgumentException('Calendar events need a start date or a simple recurrence definition.');
                }
                Dates::recurrence($event, $this->timezone());
                if (!$this->recurringEditable()) {
                    $event['editable'] = $event['startEditable'] = $event['durationEditable'] = false;
                }
            }
            $result[] = $event;
        }

        return $result;
    }
}
