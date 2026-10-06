<?php

declare(strict_types=1);

use Carbon\CarbonImmutable;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Livewire\Features\SupportLockedProperties\CannotUpdateLockedPropertyException;
use Livewire\Livewire;
use Sirius\Ui\Calendar\Dates;
use Tests\Fixtures\EloquentCalendar;
use Tests\Fixtures\PassiveCalendar;
use Tests\Fixtures\TableRecordFactory;
use Tests\Fixtures\TestCalendar;

beforeEach(function (): void {
    CarbonImmutable::setTestNow('2028-10-15T18:00:00Z');
});

afterEach(function (): void {
    CarbonImmutable::setTestNow();
});

it('resolves calendar defaults and preserves explicit props over library options', function (): void {
    config(['sirius-ui.locale' => 'id', 'sirius-ui.timezone' => 'Asia/Jakarta']);
    $test = Livewire::test(TestCalendar::class)->assertSet('settings.locale', 'id')
        ->assertSet('settings.timeZone', 'Asia/Jakarta')->assertSet('settings.initialDate', '2028-10-16')
        ->assertSet('settings.editable', false)->assertSet('settings.selectable', false);
    expect($test->get('calendarId'))->toBeString()->toMatch('/^[A-Za-z0-9]{5}$/');
    Livewire::test(TestCalendar::class, ['id' => 'custom', 'locale' => 'en_US', 'timezone' => 'UTC', 'editable' => false,
        'firstDay'                            => 0, 'options' => ['locale' => 'fr', 'timeZone' => 'Europe/Paris', 'editable' => true, 'firstDay' => 1, 'slotMinTime' => '08:00:00']])
        ->assertSet('calendarId', 'custom')->assertSet('settings.locale', 'en')->assertSet('settings.timeZone', 'UTC')
        ->assertSet('settings.firstDay', 0)->assertSet('settings.editable', false)->assertSet('settings.slotMinTime', '08:00:00');
});

it('uses application and final fallbacks when package configuration is null', function (): void {
    config(['sirius-ui.locale' => null, 'sirius-ui.timezone' => null, 'app.locale' => 'fr', 'app.timezone' => 'Europe/Paris']);
    Livewire::test(TestCalendar::class)->assertSet('settings.locale', 'fr')->assertSet('settings.timeZone', 'Europe/Paris');
    config(['app.locale' => null, 'app.timezone' => null, 'app.fallback_locale' => 'id']);
    Livewire::test(TestCalendar::class)->assertSet('settings.locale', 'id')->assertSet('settings.timeZone', 'UTC');
    config(['app.fallback_locale' => null]);
    Livewire::test(TestCalendar::class)->assertSet('settings.locale', 'en');
});

it('returns serializable events with string IDs date-only ends and readonly recurrence', function (): void {
    $test = Livewire::test(TestCalendar::class, ['timezone' => 'Asia/Jakarta', 'editable' => true]);

    $test->call('fetchEvents', '2028-09-30T17:00:00Z', '2028-11-04T17:00:00Z')
        ->assertReturned([
            ['id' => '1', 'title' => 'Planning', 'start' => '2028-10-16T09:00:00+07:00', 'end' => '2028-10-16T10:00:00+07:00', 'allDay' => false],
            ['id' => 'holiday', 'title' => 'Holiday', 'start' => '2028-10-18', 'end' => '2028-10-20', 'editable' => false, 'allDay' => true],
            ['id' => 'daily', 'title' => 'Standup', 'daysOfWeek' => [1, 2, 3, 4, 5], 'startTime' => '09:00', 'endTime' => '09:15', 'editable' => false, 'startEditable' => false, 'durationEditable' => false],
        ])->assertSet('visibleRange.start', '2028-10-01T00:00:00+07:00');
});

it('dispatches validated date range and record contexts without accepting browser event metadata', function (): void {
    $test = Livewire::test(TestCalendar::class, ['id' => 'planning', 'timezone' => 'Asia/Jakarta', 'selectable' => true]);
    $test->call('fetchEvents', '2028-10-01T00:00:00+07:00', '2028-11-01T00:00:00+07:00');

    $test->call('interact', 'select', ['start' => '2028-10-18', 'end' => '2028-10-20', 'allDay' => true, 'id' => 'other'])
        ->assertDispatched('calendar:select', id: 'planning', timezone: 'Asia/Jakarta', start: '2028-10-18', end: '2028-10-20', allDay: true);
    $test->call('interact', 'date-click', ['start' => '2028-10-16T02:00:00Z', 'allDay' => false])
        ->assertDispatched('calendar:date-click', start: '2028-10-16T09:00:00+07:00');
    $test->call('interact', 'event-click', ['eventId' => '1', 'title' => 'Forged'])
        ->assertDispatched('calendar:event-click', static fn (string $name, array $params): bool => data_get($params, 'record.title') === 'Planning');
});

it('acknowledges application mutations with old new and related record context', function (string $action): void {
    $test = Livewire::test(TestCalendar::class, ['timezone' => 'Asia/Jakarta', 'editable' => true]);
    $test->call('fetchEvents', '2028-10-01T00:00:00+07:00', '2028-11-01T00:00:00+07:00');
    $payload = [
        'eventId'    => '1',
        'old'        => ['start' => '2028-10-16T02:00:00Z', 'end' => '2028-10-16T03:00:00Z', 'allDay' => false],
        'new'        => ['start' => '2028-10-17T02:00:00Z', 'end' => '2028-10-17T03:00:00Z', 'allDay' => false],
        'relatedIds' => [],
    ];

    $test->call('interact', $action, $payload)->assertReturned(true)->assertSet('lastContext.new.start', '2028-10-17T09:00:00+07:00')
        ->set('accept', false)->call('interact', $action, $payload)->assertReturned(false);
})->with(['event-drop', 'event-resize']);

it('rejects stale edits and unscoped event IDs before application hooks run', function (): void {
    $test = Livewire::test(TestCalendar::class, ['editable' => true]);
    $test->call('fetchEvents', '2028-10-01T00:00:00Z', '2028-11-01T00:00:00Z');
    $test->call('interact', 'event-click', ['eventId' => 'another-tenant'])->assertStatus(404);
    $test = Livewire::test(TestCalendar::class, ['editable' => true]);
    $test->call('fetchEvents', '2028-10-01T00:00:00Z', '2028-11-01T00:00:00Z');
    $test->call('interact', 'event-drop', [
        'eventId' => '1',
        'old'     => ['start' => '2028-10-15T02:00:00Z', 'end' => null, 'allDay' => false],
        'new'     => ['start' => '2028-10-16T02:00:00Z', 'end' => null, 'allDay' => false],
    ])->assertStatus(409);
});

it('blocks readonly mutations and selection without opting in', function (string $action, array $payload): void {
    $test = Livewire::test(TestCalendar::class);
    $test->call('fetchEvents', '2028-10-01T00:00:00Z', '2028-11-01T00:00:00Z');

    $test->call('interact', $action, $payload)->assertStatus($action === 'select' ? 422 : 403);
})->with([
    ['event-drop', ['eventId' => '1']], ['event-resize', ['eventId' => 'holiday']],
    ['event-drop', ['eventId' => 'daily']], ['select', ['start'     => '2028-10-16', 'end' => '2028-10-17', 'allDay' => true]],
]);

it('rejects malformed navigation ranges', function (string $start, string $end): void {
    Livewire::test(TestCalendar::class)->call('fetchEvents', $start, $end)->assertStatus(422);
})->with([
    ['2028-11-01T00:00:00Z', '2028-10-01T00:00:00Z'],
    ['2028-01-01T00:00:00Z', '2030-01-01T00:00:00Z'],
]);

it('parses explicit instants without depending on browser timezone and rejects invalid dates', function (): void {
    expect(Dates::parse('2028-10-16T09:00:00+07:00', 'UTC')->toIso8601String())->toBe('2028-10-16T02:00:00+00:00');
    expect(Dates::parse('2028-02-29', 'Asia/Jakarta', true)->toDateString())->toBe('2028-02-29');
    expect(fn (): CarbonImmutable => Dates::parse('2027-02-29', 'UTC', true))->toThrow(InvalidArgumentException::class);
    expect(fn (): CarbonImmutable => Dates::parse('2028-10-16T09:00:00', 'UTC'))->toThrow(InvalidArgumentException::class);
    expect(fn (): array => Dates::span(['start' => '2028-10-16', 'end' => '2028-10-16', 'allDay' => true], 'UTC'))->toThrow(InvalidArgumentException::class);
});

it('reports the clicked recurring occurrence separately from its server definition', function (): void {
    $test = Livewire::test(TestCalendar::class, ['id' => 'schedule', 'timezone' => 'Asia/Jakarta']);
    $test->call('fetchEvents', '2028-10-01T00:00:00+07:00', '2028-11-01T00:00:00+07:00');

    $test->call('interact', 'event-click', ['eventId' => 'daily', 'occurrence' => ['start' => '2028-10-17T02:00:00Z', 'end' => '2028-10-17T02:15:00Z', 'allDay' => false]])
        ->assertDispatched('calendar:event-click', static fn (string $name, array $params): bool => data_get($params, 'occurrence.start') === '2028-10-17T09:00:00+07:00'
            && data_get($params, 'record.daysOfWeek') === [1, 2, 3, 4, 5]);
});

it('accepts a library synthesized end while preserving the original missing end in mutation context', function (): void {
    $test = Livewire::test(TestCalendar::class, ['editable' => true, 'timezone' => 'UTC', 'options' => ['forceEventDuration' => true]])
        ->set('records', [['id' => '1', 'title' => 'Meeting', 'start' => '2028-10-16T02:00:00Z', 'allDay' => false]]);
    $test->call('fetchEvents', '2028-10-01T00:00:00Z', '2028-11-01T00:00:00Z');

    $test->call('interact', 'event-drop', [
        'eventId' => '1',
        'old'     => ['start' => '2028-10-16T02:00:00Z', 'end' => '2028-10-16T03:00:00Z', 'allDay' => false],
        'new'     => ['start' => '2028-10-17T02:00:00Z', 'end' => '2028-10-17T03:00:00Z', 'allDay' => false],
    ])->assertReturned(true)->assertSet('lastContext.old.end', null);
});

it('protects server settings and scopes refresh to calendar identity', function (): void {
    $test = Livewire::test(TestCalendar::class, ['id' => 'one']);
    $test->assertSet('revision', 0);
    $test->dispatch('calendar:refresh.one');
    $test->assertSet('revision', 1)->call('changeOptions', ['timeZone' => 'Asia/Jakarta'])->assertSet('settings.timeZone', 'Asia/Jakarta')->assertSet('revision', 2);
    expect(fn () => $test->set('settings.editable', true))->toThrow(CannotUpdateLockedPropertyException::class);
});

it('rejects reserved or nonserializable options', function (array $options): void {
    $configuration = [];
    foreach ($options as $key => $value) {
        if (!is_string($key)) {
            throw new InvalidArgumentException('Test options must have string keys.');
        }
        $configuration[$key] = $value;
    }
    expect(fn () => (new TestCalendar)->mount(options: $configuration))->toThrow(InvalidArgumentException::class);
})->with([
    [['events' => []]],
    [['plugins' => []]],
    [['resources' => []]],
    [['eventDrop' => 'evil()']],
    [['eventContent' => static fn (): string => 'x']],
    [['initialView' => 'resourceTimeline']],
    [['firstDay' => 7]],
    [['initialDate' => '2028-02-30']],
    [['editable' => 'yes']],
    [['locale' => 'unavailable']],
    [['views' => ['timeGridWeek' => ['events' => []]]]],
]);

it('escapes accessible labels and supplies published calendar translations', function (): void {
    app('translator')->addLines(['sirius-ui.calendar.retry' => 'Try once more'], 'en', 'sirius');
    Livewire::test(TestCalendar::class, ['label' => '<script>alert(1)</script>'])
        ->assertSee('&lt;script&gt;', false)->assertDontSee('<script>alert(1)</script>', false)->assertSee('Try once more');
});

it('accepts a scoped Eloquent source with overlapping and exclusive date ranges', function (): void {
    config(['database.default' => 'calendar-test', 'database.connections.calendar-test' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '']]);
    DB::purge('calendar-test');
    Schema::create('table_records', function (Blueprint $table): void {
        $table->id();
        foreach (['name', 'status', 'secret', 'workspace', 'date_value', 'end_value'] as $field) {
            $table->string($field);
        }
    });
    TableRecordFactory::new()->create(['name' => 'Overlapping', 'workspace' => 'calendar', 'date_value' => '2028-09-28', 'end_value' => '2028-10-03']);
    TableRecordFactory::new()->create(['name' => 'Foreign workspace', 'workspace' => 'other', 'date_value' => '2028-10-02', 'end_value' => '2028-10-03']);
    TableRecordFactory::new()->create(['name' => 'Ended at start', 'workspace' => 'calendar', 'date_value' => '2028-09-28', 'end_value' => '2028-10-01']);
    TableRecordFactory::new()->create(['name' => 'Starts at end', 'workspace' => 'calendar', 'date_value' => '2028-10-05', 'end_value' => '2028-10-06']);

    Livewire::test(EloquentCalendar::class, ['timezone' => 'UTC'])->call('fetchEvents', '2028-10-01T00:00:00Z', '2028-10-05T00:00:00Z')
        ->assertReturned([['id' => '1', 'title' => 'Overlapping', 'start' => '2028-09-28', 'end' => '2028-10-03', 'allDay' => true]]);
});

it('rejects an unhandled mutation while preserving a missing event end', function (): void {
    $test = Livewire::test(PassiveCalendar::class, ['editable' => true, 'timezone' => 'UTC']);
    $test->call('fetchEvents', '2028-10-01T00:00:00Z', '2028-11-01T00:00:00Z')
        ->assertReturned([['id' => 'meeting', 'title' => 'Meeting', 'start' => '2028-10-16', 'allDay' => true, 'end' => null]]);
    $test->call('interact', 'event-drop', [
        'eventId' => 'meeting',
        'old'     => ['start' => '2028-10-16', 'end' => null, 'allDay' => true],
        'new'     => ['start' => '2028-10-17', 'end' => null, 'allDay' => true],
    ])->assertReturned(false);
});

it('rejects malformed interaction payloads before invoking a hook', function (string $action, array $payload): void {
    $test = Livewire::test(TestCalendar::class, ['selectable' => true, 'editable' => true]);
    $test->call('fetchEvents', '2028-10-01T00:00:00Z', '2028-11-01T00:00:00Z');

    $test->call('interact', $action, $payload)->assertStatus(422);
})->with([
    ['destroy', []], ['date-click', ['start' => '2028-10-16', 'allDay' => 'yes']],
    ['date-click', ['start' => '2028-11-01', 'allDay' => true]],
    ['select', ['start' => '2028-10-16', 'end' => '2028-10-15', 'allDay' => true]],
    ['select', ['start' => '2028-10-16T09:00:00', 'end' => '2028-10-16T10:00:00', 'allDay' => false]],
    ['event-drop', ['eventId' => '1', 'old' => [], 'new' => []]],
    ['event-click', ['eventId' => ['1']]], ['event-click', ['eventId' => '1', 'range' => ['start' => 'bad', 'end' => 'bad']]],
]);

it('retains fractional instants and handles daylight saving transitions and year boundaries', function (): void {
    expect(Dates::span(['start' => '2028-01-01T00:00:00.123Z', 'end' => null, 'allDay' => false], 'Asia/Jakarta')['start'])->toBe('2028-01-01T07:00:00.123000+07:00');
    expect(Dates::parse('2028-03-12T01:30:00-05:00', 'America/New_York')->addHour()->toIso8601String())->toBe('2028-03-12T03:30:00-04:00');
    expect(Dates::parse('2028-12-31T20:00:00Z', 'Asia/Jakarta')->toDateString())->toBe('2029-01-01');
});

it('rejects duplicate IDs unsafe URLs and unsupported or malformed recurring events', function (array $records): void {
    $calendar = new TestCalendar;
    $calendar->mount(timezone: 'UTC');
    $calendar->records = [];
    foreach ($records as $record) {
        if (!is_array($record)) {
            throw new InvalidArgumentException('Test records must be arrays.');
        }
        $event = [];
        foreach ($record as $key => $value) {
            if (!is_string($key)) {
                throw new InvalidArgumentException('Test events must have string keys.');
            }
            $event[$key] = $value;
        }
        $calendar->records[] = $event;
    }

    expect(fn (): array => $calendar->fetchEvents('2028-10-01T00:00:00Z', '2028-11-01T00:00:00Z'))->toThrow(InvalidArgumentException::class);
})->with([
    [[['id' => 1, 'title' => 'A', 'start' => '2028-10-16'], ['id' => '1', 'title' => 'B', 'start' => '2028-10-17']]],
    [[['id' => 1, 'title' => 'A', 'start' => '2028-10-16', 'url' => 'javascript:alert(1)']]],
    [[['id' => 1, 'title' => 'A', 'rrule' => 'FREQ=MONTHLY']]],
    [[['id' => 1, 'title' => 'A', 'daysOfWeek' => [7]]]],
    [[['id' => 1, 'title' => 'A', 'startTime' => '09:99']]],
    [[['id' => 1, 'title' => 'A', 'daysOfWeek' => [1], 'startRecur' => '2027-02-29']]],
    [[['id' => 1, 'title' => 'A', 'daysOfWeek' => [1], 'startRecur' => '2028-10-16', 'endRecur' => '2028-10-15']]],
]);
