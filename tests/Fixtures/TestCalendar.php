<?php

declare(strict_types=1);

namespace Tests\Fixtures;

use Carbon\CarbonImmutable;
use Sirius\Ui\Livewire\Calendar;

final class TestCalendar extends Calendar
{
    /** @var list<array<string, mixed>> */
    public array $records = [
        ['id' => 1, 'title' => 'Planning', 'start' => '2028-10-16T09:00:00+07:00', 'end' => '2028-10-16T10:00:00+07:00'],
        ['id' => 'holiday', 'title' => 'Holiday', 'start' => '2028-10-18', 'end' => '2028-10-20', 'editable' => false],
        ['id' => 'daily', 'title' => 'Standup', 'daysOfWeek' => [1, 2, 3, 4, 5], 'startTime' => '09:00', 'endTime' => '09:15'],
    ];

    /** @var array<string, mixed> */
    public array $lastContext = [];

    public bool $accept = true;

    /** @return iterable<array<string, mixed>> */
    protected function events(CarbonImmutable $start, CarbonImmutable $end, string $timezone): iterable
    {
        return collect($this->records);
    }

    /** @param array<string, mixed> $context */
    protected function onEventDrop(array $context): bool
    {
        $this->lastContext = $context;

        return $this->accept;
    }

    /** @param array<string, mixed> $context */
    protected function onEventResize(array $context): bool
    {
        return $this->onEventDrop($context);
    }

    /** @param array<string, mixed> $options */
    public function changeOptions(array $options): void
    {
        $this->configure($options);
    }
}
