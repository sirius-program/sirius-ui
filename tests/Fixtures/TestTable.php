<?php

declare(strict_types=1);

namespace Tests\Fixtures;

use Illuminate\Database\Eloquent\Builder;
use Sirius\Ui\Livewire\Table;
use Sirius\Ui\Table\Column;
use Sirius\Ui\Table\Filter;

/** @extends Table<TableRecord> */
class TestTable extends Table
{
    /** @return Builder<TableRecord> */
    protected function query(): Builder
    {
        return TableRecord::query()->where('workspace', 'design');
    }

    /** @return list<Column> */
    protected function columns(): array
    {
        return [new Column('name', 'Project', searchable: true, sortable: true), new Column('status', 'Status')];
    }

    /** @return list<Filter> */
    protected function filters(): array
    {
        return [new Filter('status', 'Status', static function (Builder $query, string $value): void {
            $query->where('status', $value)->orWhere('name', $value);
        }, type: 'select', options: ['pending' => 'Pending', 'paid' => 'Paid'])];
    }

    /** @return list<int> */
    protected function pageSizes(): array
    {
        return [2, 5];
    }

    protected function rowActionsView(): ?string
    {
        return 'table-row';
    }
}
