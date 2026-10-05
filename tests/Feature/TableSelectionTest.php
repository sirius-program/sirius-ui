<?php

declare(strict_types=1);

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Lang;
use Illuminate\Support\Facades\Schema;
use Livewire\Features\SupportLockedProperties\CannotUpdateLockedPropertyException;
use Livewire\Livewire;
use Tests\Fixtures\BulkCollectionTable;
use Tests\Fixtures\BulkTable;
use Tests\Fixtures\PlainTable;
use Tests\Fixtures\TableRecordFactory;

beforeEach(function (): void {
    config(['database.default' => 'selection-test', 'database.connections.selection-test' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '']]);
    DB::purge('selection-test');
    Schema::create('table_records', function (Blueprint $table): void {
        $table->id();
        $table->string('name');
        $table->string('status');
        $table->string('workspace');
        $table->string('secret');
    });
    app('view')->addLocation(__DIR__ . '/../Fixtures/views');
});

it('selects only the current page and exposes exact cross page IDs to consumer buttons', function (): void {
    TableRecordFactory::new()->count(3)->create();
    $table = Livewire::test(BulkTable::class, ['id' => 'bulk']);
    $table->assertSet('selectedIds', [])->call('toggleSelection', '1')->assertSet('selectedIds', [1]);
    $table->assertViewHas('pageSelected', 1);
    $table->call('togglePageSelection')->assertSet('selectedIds', [1, 2]);
    $table->assertViewHas('pageSelected', 2);
    $table->call('goToPage', 2);
    $table->assertViewHas('pageSelected', 0);
    $table->call('togglePageSelection')->assertSet('selectedIds', [1, 2, 3])->assertSee('3 selected')
        ->assertSee('data-selected-ids="[1,2,3]"', false)
        ->call('togglePageSelection')->assertSet('selectedIds', [1, 2])
        ->call('goToPage', 1)->call('togglePageSelection')->assertSet('selectedIds', []);
    expect(substr_count($table->html(), 'data-selected-ids'))->toBe(1);
});

it('preserves selection during sorting page size changes and explicit refresh', function (): void {
    $record = TableRecordFactory::new()->createOne();
    TableRecordFactory::new()->count(2)->create();
    $table = Livewire::test(BulkTable::class)->call('togglePageSelection')
        ->call('sortBy', 'name')->assertSet('selectedIds', [1, 2])
        ->set('perPage', 5)->assertSet('selectedIds', [1, 2]);
    $record->delete();
    $table->call('refreshTable')->assertSet('selectedIds', [1, 2])
        ->call('removeSelection', ['1'])->assertSet('selectedIds', [2]);
});

it('clears selection when search or registered filters change or reset', function (string $operation): void {
    TableRecordFactory::new()->create();
    $table = Livewire::test(BulkTable::class)->call('togglePageSelection');

    match ($operation) {
        'search' => $table->set('search', 'Website'),
        'filter' => $table->set('filters.status', 'pending'),
        default  => $table->call('resetFilters'),
    };
    $table->assertSet('selectedIds', []);
})->with(['search', 'filter', 'reset']);

it('refuses selections from another page or outside the scoped query', function (int $id): void {
    TableRecordFactory::new()->count(3)->create();
    TableRecordFactory::new()->create(['workspace' => 'other']);

    Livewire::test(BulkTable::class)->call('toggleSelection', $id)->assertStatus(422);
})->with(['another page' => 3, 'another workspace' => 4, 'missing record' => 999]);

it('locks selected IDs against direct client updates', function (): void {
    expect(fn () => Livewire::test(BulkTable::class)->set('selectedIds', [999]))
        ->toThrow(CannotUpdateLockedPropertyException::class);
});

it('omits selection without a bulk view and leaves empty pages unselected', function (): void {
    Livewire::test(PlainTable::class)->assertDontSee('data-table-bulk', false)
        ->assertDontSee('data-sir-choice', false)->call('togglePageSelection')->assertStatus(422);
    Livewire::test(BulkTable::class)->assertSee('0 selected')->assertSee('colspan="4"', false)
        ->call('togglePageSelection')->assertSet('selectedIds', []);
});

it('normalizes submitted IDs to original Collection key types without duplicates', function (): void {
    $rows = [['id' => '001', 'name' => 'First', 'workspace' => 'design'], ['id' => 2, 'name' => 'Second', 'workspace' => 'design']];

    Livewire::test(BulkCollectionTable::class, ['rows' => $rows])->call('toggleSelection', '2')
        ->assertSet('selectedIds', [2])->call('togglePageSelection')->assertSet('selectedIds', [2, '001'])
        ->call('removeSelection', [2, '2'])->assertSet('selectedIds', ['001']);
});

it('isolates explicit selection cleanup events by Table ID', function (): void {
    TableRecordFactory::new()->count(2)->create();
    $first = Livewire::test(BulkTable::class, ['id' => 'first']);
    $first->call('togglePageSelection');
    $second = Livewire::test(BulkTable::class, ['id' => 'second']);
    $second->call('togglePageSelection');

    $first->dispatch('table:remove-selection.first', ids: ['1']);
    $first->assertSet('selectedIds', [2]);
    $second->assertSet('selectedIds', [1, 2]);
    $first->dispatch('table:clear-selection.first');
    $first->assertSet('selectedIds', []);
    $second->assertSet('selectedIds', [1, 2]);
});

it('translates selection UI and blocks interactive selection during external loading', function (): void {
    TableRecordFactory::new()->create();
    Lang::addLines(['sirius-ui.table' => ['bulk_actions' => 'Batch tools', 'select_page' => 'Pick page', 'select_record' => 'Pick :id', 'selected_count' => ':count picked']], 'en', 'sirius');

    Livewire::test(BulkTable::class)->assertSee('Batch tools')->assertSee('Pick page')->assertSee('Pick 1')->assertSee('0 picked');
    Livewire::test(BulkTable::class, ['loading' => true])->call('toggleSelection', 1)->assertStatus(422);
});

it('rejects malformed explicit removal IDs', function (): void {
    Livewire::test(BulkTable::class)->call('removeSelection', [['id' => 1]])->assertStatus(422);
});
