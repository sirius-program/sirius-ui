<?php

declare(strict_types=1);

namespace Tests\Fixtures;

use Carbon\CarbonImmutable;
use Sirius\Ui\Livewire\Calendar;

final class PassiveCalendar extends Calendar
{
    /** @return iterable<array<string, mixed>> */
    protected function events(CarbonImmutable $start, CarbonImmutable $end, string $timezone): iterable
    {
        return [['id' => 'meeting', 'title' => 'Meeting', 'start' => '2028-10-16', 'allDay' => true]];
    }
}
