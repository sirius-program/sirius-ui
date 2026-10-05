<?php

declare(strict_types=1);

namespace Tests\Fixtures;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;
use Sirius\Ui\Livewire\Table;
use Sirius\Ui\Table\Column;
use Sirius\Ui\Table\Filter;

/** @extends Table<Model> */
class CollectionTable extends Table
{
    /** @var array<array-key, mixed> */
    public array $rows = [];

    public string $recordType = 'array';

    /** @return Collection<array-key, array<string, mixed>|\stdClass|TableRecord> */
    protected function query(): Collection
    {
        return collect($this->rows)->map(function (mixed $record): array|object {
            if (!is_array($record)) {
                throw new \InvalidArgumentException('Fixture rows must be arrays.');
            }

            $model = new TableRecord;
            $model->setKeyType('string');
            foreach ($record as $key => $value) {
                if (!is_string($key)) {
                    throw new \InvalidArgumentException('Fixture attributes must use string keys.');
                }
                $model->setAttribute($key, $value);
            }

            return match ($this->recordType) {
                'object' => (object) $record,
                'model'  => $model,
                default  => $record,
            };
        })->filter(static fn (array|object $record): bool => data_get($record, 'workspace') === 'design');
    }

    /** @return list<Column> */
    protected function columns(): array
    {
        return [
            new Column('name', 'Project', searchable: true, sortable: true),
            new Column('customer', 'Customer', field: 'details.customer', searchable: true, sortable: true),
            new Column('status', 'Status', sortable: true),
            new Column('amount', 'Amount', format: static function (mixed $value, array|object $record): string {
                $name = data_get($record, 'name');

                return '<b>' . (is_scalar($name) ? (string) $name : '') . ':' . (is_scalar($value) ? (string) $value : '') . '</b>';
            }),
        ];
    }

    /** @return list<Filter> */
    protected function filters(): array
    {
        return [new Filter('status', 'Status', static fn (Collection $rows, string $value): Collection => $rows->where('status', $value),
            type: 'select', options: ['pending'                                                        => 'Pending', 'paid' => 'Paid'])];
    }

    protected function rowActionsView(): string
    {
        return 'collection-row';
    }

    /** @return list<int> */
    protected function pageSizes(): array
    {
        return [2, 5];
    }
}
