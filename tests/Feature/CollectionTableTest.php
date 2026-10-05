<?php

declare(strict_types=1);

use Illuminate\Database\Eloquent\Model;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\View\View;
use Livewire\Livewire;
use Sirius\Ui\Livewire\Table;
use Sirius\Ui\Table\Column;
use Sirius\Ui\Table\Filter;
use Tests\Fixtures\CollectionTable;
use Tests\Fixtures\TableRecord;

beforeEach(function (): void {
    app('view')->addLocation(__DIR__ . '/../Fixtures/views');
});

it('searches filters formats and paginates Collection records without a database', function (string $recordType): void {
    $rows = [
        'z'       => ['id' => 'p3', 'name' => 'Zebra', 'details' => ['customer' => 'NORTHSTAR'], 'status' => 'paid', 'amount' => 30, 'workspace' => 'design'],
        'a'       => ['id' => 'p1', 'name' => 'Alpha', 'details' => ['customer' => 'Northstar'], 'status' => 'pending', 'amount' => 10, 'workspace' => 'design'],
        'b'       => ['id' => 'p2', 'name' => 'Beta', 'details' => ['customer' => 'Orbit'], 'status' => 'paid', 'amount' => 20, 'workspace' => 'design'],
        'private' => ['id' => 'p4', 'name' => 'Private', 'details' => ['customer' => 'Northstar'], 'status' => 'paid', 'amount' => 40, 'workspace' => 'other'],
    ];

    $table = Livewire::test(CollectionTable::class, ['id' => 'collection', 'rows' => $rows, 'recordType' => $recordType])
        ->assertSee('1–2 · 2 shown of 3 data')->assertSee('href="/projects/p3"', false)
        ->assertSee('&lt;b&gt;Zebra:30&lt;/b&gt;', false)->assertDontSee('<b>Zebra:30</b>', false)->assertDontSee('Private');
    $table->call('goToPage', 2)->assertSee('Beta')->assertDontSee('Zebra')
        ->set('search', 'northstar')->assertSet('page', 1)->assertSee('Zebra')->assertSee('Alpha')->assertDontSee('Beta')
        ->set('filters.status', 'paid')->assertSee('1 shown of 1 data')->assertDontSee('Alpha')
        ->call('resetFilters')->assertSet('search', 'northstar')->assertSee('2 shown of 2 data');
    expect($table->get('rows'))->toBe($rows);
})->with(['array', 'object', 'model']);

it('cycles compound Collection sorting with ID tie breakers and restores source order', function (): void {
    $rows = [
        ['id' => 3, 'name' => 'Same', 'status' => 'pending', 'workspace' => 'design'],
        ['id' => 2, 'name' => 'Same', 'status' => 'paid', 'workspace' => 'design'],
        ['id' => 1, 'name' => 'Same', 'status' => 'paid', 'workspace' => 'design'],
    ];
    $table = Livewire::test(CollectionTable::class, ['rows' => $rows])->call('sortBy', 'name')->call('sortBy', 'status', true);
    $table->assertViewHas('records', static fn (LengthAwarePaginator $records): bool => $records->pluck('id')->all() === [1, 2]);
    $table->call('sortBy', 'status', true);
    $table->assertViewHas('records', static fn (LengthAwarePaginator $records): bool => $records->pluck('id')->all() === [3, 1]);
    $table->call('sortBy', 'status', true)->call('sortBy', 'name')->call('sortBy', 'name');
    $table->assertViewHas('records', static fn (LengthAwarePaginator $records): bool => $records->pluck('id')->all() === [3, 2]);
    $table->call('goToPage', 2)->set('rows', array_slice($rows, 0, 1))->call('refreshTable')
        ->assertSet('page', 1)->assertSee('1 shown of 1 data')
        ->set('rows', [])->assertSee('No data found.')->assertSee('0–0 · 0 shown of 0 data');
});

it('rejects tampered Collection query state', function (array $rows, string $property, mixed $value): void {
    Livewire::test(CollectionTable::class, ['rows' => $rows])->set($property, $value)->assertStatus(422);
})->with([
    'unknown filter'    => [[['id' => 1, 'workspace' => 'design']], 'filters.secret', 'x'],
    'invalid selection' => [[['id' => 1, 'workspace' => 'design']], 'filters.status', 'unlisted'],
    'invalid direction' => [[['id' => 1, 'workspace' => 'design']], 'sorts', ['name' => 'unsafe']],
    'invalid page size' => [[['id' => 1, 'workspace' => 'design']], 'perPage', 100],
]);

it('rejects missing empty and duplicate Collection record IDs', function (array $rows): void {
    $table = new CollectionTable;
    $table->rows = $rows;
    $table->mount();

    expect(fn (): View => $table->render())->toThrow(InvalidArgumentException::class);
})->with([
    'missing'   => [[['workspace' => 'design']]],
    'empty'     => [[['id' => '', 'workspace' => 'design']]],
    'invalid'   => [[['id' => [], 'workspace' => 'design']]],
    'duplicate' => [[['id' => 1, 'workspace' => 'design'], ['id' => '1', 'workspace' => 'design']]],
]);

it('accepts an Eloquent Collection without querying a database', function (): void {
    /** @extends Table<Model> */
    $table = new class extends Table
    {
        /** @return Illuminate\Database\Eloquent\Collection<int, TableRecord> */
        protected function query(): Collection
        {
            return new Illuminate\Database\Eloquent\Collection([
                new TableRecord(['id' => 0, 'name' => 'Unsaved project']),
            ]);
        }

        /** @return list<Column> */
        protected function columns(): array
        {
            return [new Column('name', 'Project')];
        }
    };
    $table->mount();

    $data = $table->render()->getData();
    expect(data_get($data, 'recordKeys'))->toBe([0]);
    expect(data_get($data, 'records.0.name'))->toBe('Unsaved project');
});

it('allows a custom record key for Collection records', function (): void {
    $table = new class extends CollectionTable
    {
        /** @param array<array-key, mixed>|object $record */
        protected function recordKey(array|object $record): int|string
        {
            return parent::recordKey(['id' => data_get($record, 'uuid')]);
        }
    };
    $table->rows = [['uuid' => 'project-a', 'name' => 'Custom key', 'workspace' => 'design']];
    $table->mount('custom');

    expect($table->render()->getData()['recordKeys'])->toBe(['project-a']);
});

it('rejects Collection filters that do not return a Collection', function (): void {
    $table = new class extends CollectionTable
    {
        /** @return list<Filter> */
        protected function filters(): array
        {
            return [new Filter('status', 'Status', static function (Collection $rows, string $value): void {
                $rows->where('status', $value);
            })];
        }
    };
    $table->rows = [['id' => 1, 'workspace' => 'design']];
    $table->mount();
    $table->filters['status'] = 'paid';

    expect(fn (): View => $table->render())->toThrow(InvalidArgumentException::class, 'must return a Collection');
});

it('rejects scalar Collection records', function (): void {
    /** @extends Table<Model> */
    $table = new class extends Table
    {
        /** @return Collection<int, int> */
        protected function query(): Collection
        {
            return collect([1]);
        }

        /** @return list<Column> */
        protected function columns(): array
        {
            return [new Column('name', 'Project')];
        }
    };
    $table->mount();

    expect(fn (): View => $table->render())->toThrow(InvalidArgumentException::class, 'must be arrays or objects');
});
