<?php

declare(strict_types=1);

namespace Tests\Fixtures;

use Carbon\CarbonImmutable;
use Sirius\Ui\Livewire\Calendar;

final class EloquentCalendar extends Calendar
{
    /** @return iterable<array<string, mixed>> */
    protected function events(CarbonImmutable $start, CarbonImmutable $end, string $timezone): iterable
    {
        return TableRecord::query()->where('workspace', 'calendar')
            ->where('date_value', '<', $end->toDateString())->where('end_value', '>', $start->toDateString())
            ->get()->map(static function (TableRecord $record): array {
                $id = $record->getKey();
                $title = $record->getAttribute('name');
                $start = $record->getAttribute('date_value');
                $end = $record->getAttribute('end_value');
                if (!is_int($id) || !is_string($title) || !is_string($start) || !is_string($end)) {
                    throw new \InvalidArgumentException('Invalid sample record.');
                }

                return ['id' => $id, 'title' => $title, 'start' => $start, 'end' => $end, 'allDay' => true];
            });
    }
}
