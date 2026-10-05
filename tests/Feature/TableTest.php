<?php

declare(strict_types=1);

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Livewire\Features\SupportLockedProperties\CannotUpdateLockedPropertyException;
use Livewire\Livewire;
use Sirius\Ui\Table\Column;
use Sirius\Ui\Table\Filter;
use Tests\Fixtures\MultiSortTable;
use Tests\Fixtures\PlainTable;
use Tests\Fixtures\TableRecord;
use Tests\Fixtures\TableRecordFactory;
use Tests\Fixtures\TestTable;
use Tests\Fixtures\WidgetTable;

beforeEach(function (): void {
    config(['database.default' => 'table-test', 'database.connections.table-test' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '']]);
    DB::purge('table-test');
    Schema::create('table_records', function (Blueprint $table): void {
        $table->id();
        $table->string('name');
        $table->string('status');
        $table->string('workspace');
        $table->string('secret');
        $table->string('date_value')->default('2028-02-29');
        $table->string('time_value')->default('09:30');
        $table->string('datetime_value')->default('2028-02-29 09:30:00');
    });
    app('view')->addLocation(__DIR__ . '/../Fixtures/views');
});

it('renders package filter widgets and native search inputs', function (): void {
    $table = Livewire::test(WidgetTable::class, ['id' => 'widgets'])->assertSee('data-sir-select', false)
        ->assertSee('data-sir-datetime-picker', false)->assertSee('&quot;url&quot;:&quot;\/options&quot;', false);
    $html = new DOMXPath(tap(new DOMDocument, static fn (DOMDocument $doc): bool => @$doc->loadHTML($table->html())));
    expect($html->evaluate('count(//input[@type="search"])'))->toBe(2.0);
});

it('applies canonical temporal filters and clears then resets a nonempty select default', function (string $type, string $value): void {
    TableRecordFactory::new()->create(['name' => 'Included', 'status' => 'paid']);
    TableRecordFactory::new()->create(['name' => 'Excluded', 'status' => 'paid', $type . '_value' => $type === 'date' ? '2028-03-01' : ($type === 'time' ? '10:30' : '2028-03-01 10:30:00')]);
    TableRecordFactory::new()->create(['name' => 'Pending', 'status' => 'pending']);

    Livewire::test(WidgetTable::class)->set('filters.' . $type, $value)->assertSee('Included')->assertDontSee('Excluded')
        ->set('filters.status')->assertSee('Pending')->call('resetFilters')->assertSet('filters.status', 'paid');
})->with([['date', '2028-02-29'], ['time', '09:30'], ['datetime', '2028-02-29 09:30:00']]);

it('rejects invalid temporal and remote filter values', function (string $key, mixed $value): void {
    Livewire::test(WidgetTable::class)->set('filters.' . $key, $value)->assertStatus(422);
})->with([['date', '2027-02-29'], ['date', '2028-2-29'], ['time', '25:00'], ['time', '09:30:00'],
    ['datetime', '2028-02-30 09:30:00'], ['datetime', '2028-02-29T09:30:00'], ['date', "2028-02-29\0"], ['remote', ['x']], ['remote', str_repeat('x', 501)]]);

it('accepts remote options outside the initial list within the scoped query', function (): void {
    TableRecordFactory::new()->create(['name' => 'Remote project', 'status' => 'paid']);
    TableRecordFactory::new()->create(['name' => 'Remote project', 'status' => 'paid', 'workspace' => 'other']);

    Livewire::test(WidgetTable::class)->set('filters.remote', 'Remote project')
        ->assertSee('Remote project')->assertSee('1 shown of 1 data');
});

it('checks canonical syntax independently of the server daylight saving timezone', function (): void {
    $timezone = date_default_timezone_get();
    try {
        date_default_timezone_set('America/New_York');
        TableRecordFactory::new()->create(['name' => 'UTC schedule', 'status' => 'paid', 'datetime_value' => '2028-03-12 02:30:00']);
        Livewire::test(WidgetTable::class)->set('filters.datetime', '2028-03-12 02:30:00')->assertSee('UTC schedule');
    } finally {
        date_default_timezone_set($timezone);
    }
});

it('formats escaped cells with raw value and record while retaining database sorting and search', function (): void {
    TableRecordFactory::new()->create(['name' => 'Zebra', 'status' => 'paid']);
    TableRecordFactory::new()->create(['name' => 'Alpha', 'status' => 'paid']);

    $table = Livewire::test(WidgetTable::class)->call('sortBy', 'name')->assertSee('&lt;b&gt;Alpha:2&lt;/b&gt;', false)
        ->assertDontSee('<b>Alpha:2</b>', false);
    $table->assertViewHas('records', static fn (mixed $records): bool => $records instanceof LengthAwarePaginator && $records->pluck('id')->all() === [2, 1]);
    $table->set('search', 'Zebra')->assertSee('Zebra:1')->assertDontSee('Alpha:2');
});

it('restricts remote search configuration to selects and normalizes their options', function (): void {
    expect(fn (): Filter => new Filter('bad', 'Bad', static function (): void {}, searchUrl: '/options'))->toThrow(InvalidArgumentException::class);
    expect(fn (): Filter => new Filter('bad', 'Bad', static function (): void {}, type: 'select', searchUrl: ' '))->toThrow(InvalidArgumentException::class);
    expect((new Filter('good', 'Good', static function (): void {}, type: 'select', options: ['42' => 'Answer']))->selectOptions())
        ->toBe([['value' => '42', 'label' => 'Answer']]);
});

it('groups search and filter OR clauses inside the consumer workspace scope', function (): void {
    TableRecordFactory::new()->create(['name' => 'Visible project', 'status' => 'paid']);
    TableRecordFactory::new()->create(['name' => 'Private project', 'status' => 'paid', 'workspace' => 'other']);

    Livewire::test(TestTable::class)->set('search', 'project')->set('filters.status', 'paid')
        ->assertSee('Visible project')->assertDontSee('Private project')->assertDontSee('Never serialized');
});

it('paginates tied values deterministically and resets the page for query changes', function (): void {
    TableRecordFactory::new()->count(6)->create();

    $table = Livewire::test(TestTable::class)->call('sortBy', 'name')->call('goToPage', 2);
    $table->assertSee('data-table-row="3"', false)
        ->assertDontSee('data-table-row="1"', false)
        ->set('search', 'Website')->assertSet('page', 1)
        ->call('goToPage', 2)->set('filters.status', 'pending')->assertSet('page', 1)
        ->call('goToPage', 2)->set('perPage', 5)->assertSet('page', 1)
        ->assertSee('1–5 · 5 shown of 6 data');
});

it('refreshes after removal without losing filters or sorting and clamps a stale page', function (): void {
    TableRecordFactory::new()->count(3)->create(['status' => 'paid']);
    $table = Livewire::test(TestTable::class, ['id' => 'projects'])->set('filters.status', 'paid')->call('sortBy', 'name')->call('goToPage', 2);
    TableRecord::query()->findOrFail(3)->delete();

    $table->dispatch('table:refresh.projects');
    $table->assertSet('page', 1)
        ->assertSet('filters.status', 'paid')->assertSet('sorts', ['name' => 'asc'])->assertSee('1–2 · 2 shown of 2 data');
});

it('restores filter defaults without clearing the separate global search', function (): void {
    TableRecordFactory::new()->create();

    Livewire::test(TestTable::class)->set('search', 'Website')->set('filters.status', 'paid')
        ->assertSee('No data found.')->call('resetFilters')->assertSet('search', 'Website')
        ->assertSet('filters.status', '')->assertSee('Website redesign');
});

it('rejects unregistered or malformed query state', function (string $property, mixed $value): void {
    Livewire::test(TestTable::class)->set($property, $value)->assertStatus(422);
})->with([
    'sort field injection'        => ['sorts', ['name desc; drop table table_records' => 'asc']],
    'unsortable field'            => ['sorts', ['status' => 'asc']],
    'sort direction injection'    => ['sorts', ['name' => 'desc; delete']],
    'nested sort direction'       => ['sorts', ['name' => ['asc']]],
    'numeric sort key'            => ['sorts', ['asc']],
    'page size outside allowlist' => ['perPage', 10000],
    'unknown filter'              => ['filters.secret', 'anything'],
    'unlisted select value'       => ['filters.status', 'unauthorized'],
    'array filter input'          => ['filters.status', ['paid']],
    'excessive search'            => ['search', str_repeat('x', 501)],
]);

it('rejects an unsortable key through the heading action', function (): void {
    Livewire::test(TestTable::class)->call('sortBy', 'secret')->assertStatus(422);
});

it('renders record context in consumer row views and escapes default cells', function (): void {
    $record = TableRecordFactory::new()->createOne(['name' => '<script>alert(1)</script>']);

    Livewire::test(TestTable::class)->assertSee('href="/projects/' . $record->id . '"', false)
        ->assertSee('&lt;script&gt;alert(1)&lt;/script&gt;', false)->assertDontSee('<script>alert(1)</script>', false)
        ->assertDontSee('Never serialized');
});

it('uses translated counts and empty labels with explicit or generated IDs', function (): void {
    __('sirius::sirius-ui.table.record_label');
    app('translator')->addLines(['sirius-ui.table.record_label' => 'projects', 'sirius-ui.table.empty' => 'No :label available.'], 'en', 'sirius');

    Livewire::test(TestTable::class, ['id' => 'projects'])->assertSee('id="projects"', false)->assertSee('No projects available.')
        ->assertSee('0–0 · 0 shown of 0 projects');
    $table = Livewire::test(TestTable::class, ['recordLabel' => 'invoices'])->assertSee('No invoices available.');
    expect($table->get('tableId'))->toHaveLength(5);
});

it('keeps configuration locked and independent across instances', function (): void {
    TableRecordFactory::new()->count(3)->create();
    $first = Livewire::test(TestTable::class, ['id' => 'first'])->call('goToPage', 2);
    $second = Livewire::test(TestTable::class, ['id' => 'second']);

    $first->assertSet('page', 2);
    $second->assertSet('page', 1);
    expect(fn () => $first->set('tableId', 'second'))->toThrow(CannotUpdateLockedPropertyException::class);
});

it('validates server column and filter definitions before rendering', function (): void {
    expect(fn (): Column => new Column('unsafe-key', 'Name'))->toThrow(InvalidArgumentException::class);
    expect(fn (): Column => new Column('name', 'Name', field: 'name;delete'))->toThrow(InvalidArgumentException::class);
    expect(fn (): Filter => new Filter('status', 'Status', static function (): void {}, type: 'select', options: ['paid' => 'Paid'], default: 'unknown'))->toThrow(InvalidArgumentException::class);
});

it('renders without optional filters or row actions and keeps the empty column span correct', function (): void {
    Livewire::test(PlainTable::class)->assertSee('colspan="2"', false)->assertSee('No data found.')
        ->assertDontSee('data-sir-dropdown', false)->assertDontSee('Actions');
});

it('bounds the numeric pagination window and clamps an out of range request', function (): void {
    TableRecordFactory::new()->count(40)->create();

    Livewire::test(TestTable::class)->assertSee('aria-label="Page 20"', false)->assertDontSee('aria-label="Page 10"', false)
        ->call('goToPage', 10)->assertSee('aria-label="Page 8"', false)->assertSee('aria-label="Page 12"', false)
        ->assertDontSee('aria-label="Page 7"', false)->call('goToPage', 999999)->assertSet('page', 20)
        ->assertSee('39–40 · 2 shown of 40 data');
});

it('keeps explicit parent loading over results and pagination while leaving toolbar controls available', function (): void {
    $table = Livewire::test(TestTable::class, ['id' => 'loading-table', 'loading' => true])->assertSee('data-external-loading="true"', false)
        ->assertSee('aria-busy="true"', false)->assertSee('inert', false);
    $html = new DOMXPath(tap(new DOMDocument, static fn (DOMDocument $doc): bool => @$doc->loadHTML($table->html())));
    expect($html->evaluate('count(//*[@id="loading-table-search"]/ancestor::*[@inert])'))->toBe(0.0)
        ->and($html->evaluate('count(//*[@id="loading-table-filters-trigger"]/ancestor::*[@inert])'))->toBe(0.0)
        ->and($html->evaluate('count(//table/ancestor::*[@inert])'))->toBe(1.0)
        ->and($html->evaluate('count(//*[@id="loading-table-per-page"]/ancestor::*[@inert])'))->toBe(1.0);
});

it('cycles sorting through ascending descending and the consumer default order', function (): void {
    TableRecordFactory::new()->create(['name' => 'Zebra']);
    TableRecordFactory::new()->create(['name' => 'Alpha']);

    $table = Livewire::test(TestTable::class)->call('sortBy', 'name');
    $table->assertViewHas('records', static fn (mixed $records): bool => $records instanceof LengthAwarePaginator && $records->pluck('id')->all() === [2, 1]);
    $table->call('sortBy', 'name')->assertSet('sorts', ['name' => 'desc']);
    $table->assertViewHas('records', static fn (mixed $records): bool => $records instanceof LengthAwarePaginator && $records->pluck('id')->all() === [1, 2]);
    $table->call('sortBy', 'name')->assertSet('sorts', []);
    $table->assertViewHas('records', static fn (mixed $records): bool => $records instanceof LengthAwarePaginator && $records->pluck('id')->all() === [1, 2]);
});

it('keeps multi column sort priority and removes only the shift clicked column', function (): void {
    TableRecordFactory::new()->create(['name' => 'Zebra', 'status' => 'paid']);
    TableRecordFactory::new()->create(['name' => 'Alpha', 'status' => 'pending']);
    TableRecordFactory::new()->create(['name' => 'Alpha', 'status' => 'paid']);

    $table = Livewire::test(MultiSortTable::class)->call('sortBy', 'name')->call('goToPage', 2)
        ->call('sortBy', 'status', true)->assertSet('page', 1)->assertSet('sorts', ['name' => 'asc', 'status' => 'asc']);
    $table->assertViewHas('records', static fn (mixed $records): bool => $records instanceof LengthAwarePaginator && $records->pluck('id')->all() === [3, 2]);
    $table->call('sortBy', 'status', true)->assertSet('sorts', ['name' => 'asc', 'status' => 'desc']);
    $table->assertViewHas('records', static fn (mixed $records): bool => $records instanceof LengthAwarePaginator && $records->pluck('id')->all() === [2, 3]);
    $table->call('sortBy', 'name', true)->call('sortBy', 'name', true)->assertSet('sorts', ['status' => 'desc']);
    $table->assertViewHas('records', static fn (mixed $records): bool => $records instanceof LengthAwarePaginator && $records->pluck('id')->all() === [2, 1]);
    $table->call('sortBy', 'name')->assertSet('sorts', ['name' => 'asc']);
});

it('translates all Table controls and disables back next at pagination boundaries', function (): void {
    __('sirius::sirius-ui.table.search');
    app('translator')->addLines([
        'sirius-ui.table.actions'       => 'Aksi', 'sirius-ui.table.search' => 'Cari',
        'sirius-ui.table.reset_filters' => 'Atur ulang filter', 'sirius-ui.table.back' => 'Kembali',
        'sirius-ui.table.next'          => 'Berikutnya', 'sirius-ui.table.ascending' => 'menaik',
        'sirius-ui.table.sort_priority' => ':column :direction prioritas :priority',
    ], 'en', 'sirius');
    TableRecordFactory::new()->count(3)->create();

    $table = Livewire::test(TestTable::class)->assertSee('Aksi')->assertSee('placeholder="Cari"', false)
        ->assertSee('Atur ulang filter')->assertSee('Kembali')->assertSee('Berikutnya')->call('sortBy', 'name')
        ->assertSee('Project menaik prioritas 1');
    $html = new DOMXPath(tap(new DOMDocument, static fn (DOMDocument $doc): bool => @$doc->loadHTML($table->html())));
    expect($html->evaluate('count(//button[normalize-space(.)="Kembali"]/@disabled)'))->toBe(1.0)
        ->and($html->evaluate('count(//button[normalize-space(.)="Berikutnya"]/@disabled)'))->toBe(0.0);
    $table->call('goToPage', 2);
    $html = new DOMXPath(tap(new DOMDocument, static fn (DOMDocument $doc): bool => @$doc->loadHTML($table->html())));
    expect($html->evaluate('count(//button[normalize-space(.)="Kembali"]/@disabled)'))->toBe(0.0)
        ->and($html->evaluate('count(//button[normalize-space(.)="Berikutnya"]/@disabled)'))->toBe(1.0);
});
