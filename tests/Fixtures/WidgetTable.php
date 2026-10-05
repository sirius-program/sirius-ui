<?php

declare(strict_types=1);

namespace Tests\Fixtures;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Sirius\Ui\Table\Column;
use Sirius\Ui\Table\Filter;

final class WidgetTable extends TestTable
{
    /** @return list<Column> */
    protected function columns(): array
    {
        return [new Column('name', 'Project', searchable: true, sortable: true,
            format: static fn (mixed $value, Model $record): string => '<b>' . (is_string($value) ? $value : '') . ':' . (is_scalar($record->getKey()) ? $record->getKey() : '') . '</b>'),
            new Column('status', 'Status', view: 'table-cell', format: static fn (): never => throw new \LogicException('Cell views take precedence.'))];
    }

    /** @return list<Filter> */
    protected function filters(): array
    {
        $filters = [new Filter('status', 'Status', static function (Builder $query, string $value): void {
            $query->where('status', $value);
        }, type: 'select', options: ['pending' => 'Pending', 'paid' => 'Paid'], default: 'paid'),
            new Filter('remote', 'Remote', static function (Builder $query, string $value): void {
                $query->where('name', $value);
            }, type: 'select', searchUrl: '/options'),
            new Filter('text', 'Text', static function (Builder $query, string $value): void {
                $query->where('name', 'like', '%' . $value . '%');
            })];
        foreach (['date', 'time', 'datetime'] as $type) {
            $filters[] = new Filter($type, ucfirst($type), static function (Builder $query, string $value) use ($type): void {
                $query->where($type . '_value', $value);
            }, type: $type);
        }

        return $filters;
    }
}
