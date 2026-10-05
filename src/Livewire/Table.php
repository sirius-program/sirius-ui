<?php

declare(strict_types=1);

namespace Sirius\Ui\Livewire;

use DateTimeImmutable;
use DateTimeZone;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Illuminate\View\View;
use InvalidArgumentException;
use Livewire\Attributes\Locked;
use Livewire\Attributes\On;
use Livewire\Attributes\Reactive;
use Livewire\Component;
use Sirius\Ui\Table\Column;
use Sirius\Ui\Table\Filter;

/** @template TModel of Model */
abstract class Table extends Component
{
    #[Locked]
    public string $tableId;

    #[Locked]
    public ?string $recordLabel = null;

    #[Reactive]
    public bool $loading = false;

    public string $search = '';

    /** @var array<string, mixed> */
    public array $filters = [];

    /** @var array<array-key, mixed> */
    public array $sorts = [];

    public int $perPage = 10;

    public int $page = 1;

    /** @return Builder<TModel>|Collection<array-key, *> */
    abstract protected function query(): Builder|Collection;

    /** @return list<Column> */
    abstract protected function columns(): array;

    /** @return list<Filter> */
    protected function filters(): array
    {
        return [];
    }

    protected function rowActionsView(): ?string
    {
        return null;
    }

    /** @param array<array-key, mixed>|object $record */
    protected function recordKey(array|object $record): int|string
    {
        $key = $record instanceof Model ? $record->getKey() : data_get($record, 'id');
        if ((!is_int($key) && !is_string($key)) || $key === '') {
            throw new InvalidArgumentException('Table records require a nonempty string or integer ID. Override recordKey() for another key.');
        }

        return $key;
    }

    /** @return list<int> */
    protected function pageSizes(): array
    {
        return [10, 25, 50];
    }

    public function mount(?string $id = null, ?string $recordLabel = null): void
    {
        $this->tableId = $id ?? Str::random(5);
        if (!preg_match('/^[a-zA-Z0-9_-]+$/D', $this->tableId) || $recordLabel === '') {
            throw new InvalidArgumentException('Table requires a safe ID and an optional nonempty record label.');
        }
        $this->recordLabel = $recordLabel;
        $this->perPage = $this->validPageSizes()[0];
        $this->resetFilters();
    }

    public function updated(string $property): void
    {
        if ($property === 'search' || $property === 'filters' || str_starts_with($property, 'filters.') || $property === 'perPage') {
            $this->page = 1;
        }
    }

    public function resetFilters(): void
    {
        $this->filters = [];
        foreach ($this->definitions($this->filters()) as $filter) {
            $this->filters[$filter->key] = $filter->default;
        }
        $this->page = 1;
    }

    public function sortBy(string $key, bool $additive = false): void
    {
        $columns = $this->definitions($this->columns());
        $column = $columns[$key] ?? null;
        abort_unless($column?->sortable === true, 422);
        $sorts = $this->validatedSorts($columns);
        $current = $sorts[$key] ?? null;
        $this->sorts = $additive ? $sorts : [];
        if ($current === 'desc') {
            unset($this->sorts[$key]);
        } else {
            $this->sorts[$key] = $current === 'asc' ? 'desc' : 'asc';
        }
        $this->page = 1;
    }

    public function goToPage(int $page): void
    {
        $this->page = max(1, $page);
    }

    #[On('table:refresh.{tableId}')]
    public function refreshTable(): void
    {
        // Livewire renders after this explicit refresh; records() clamps a stale page.
        $this->page = max(1, $this->page);
    }

    public function render(): View
    {
        $columns = $this->definitions($this->columns());
        if ($columns === []) {
            throw new InvalidArgumentException('Table requires at least one column.');
        }
        $filterDefinitions = $this->definitions($this->filters());
        $sizes = $this->validPageSizes();
        abort_unless(in_array($this->perPage, $sizes, true) && mb_strlen($this->search) <= 500, 422);
        $sorts = $this->validatedSorts($columns);
        foreach (array_keys($this->filters) as $key) {
            abort_unless(isset($filterDefinitions[$key]), 422);
        }

        $source = $this->query();
        $records = $source instanceof Collection
            ? $this->collectionRecords($source, $columns, $filterDefinitions, $sorts)
            : $this->databaseRecords(clone $source, $columns, $filterDefinitions, $sorts);

        return view('sirius::livewire.table', [
            'columns'           => $columns,
            'filterDefinitions' => $filterDefinitions,
            'pageSizes'         => $sizes,
            'records'           => $records,
            'recordKeys'        => $records->getCollection()->map(fn (array|object $record): int|string => $this->recordKey($record))->values()->all(),
            'pages'             => $this->pageNumbers($records),
            'sortPositions'     => array_flip(array_keys($sorts)),
            'rowActionsView'    => $this->rowActionsView(),
            'entityLabel'       => $this->recordLabel ?? __('sirius::sirius-ui.table.record_label'),
        ]);
    }

    /**
     * @param  Builder<TModel>  $query
     * @param  array<string, Column>  $columns
     * @param  array<string, Filter>  $filterDefinitions
     * @param  array<string, 'asc'|'desc'>  $sorts
     * @return LengthAwarePaginator<int, TModel>
     */
    private function databaseRecords(Builder $query, array $columns, array $filterDefinitions, array $sorts): LengthAwarePaginator
    {
        $term = trim($this->search);
        $searchable = array_filter($columns, static fn (Column $column): bool => $column->searchable);
        if ($term !== '' && $searchable !== []) {
            $query->where(function (Builder $nested) use ($searchable, $term): void {
                foreach ($searchable as $column) {
                    $nested->orWhere($column->field, 'like', '%' . $term . '%');
                }
            });
        }
        foreach ($filterDefinitions as $filter) {
            $value = $this->filterValue($filter);
            if ($value !== '') {
                // Group application filters so an OR cannot escape the consumer's base scope.
                $query->where(function (Builder $nested) use ($filter, $value): void {
                    ($filter->apply)($nested, $value);
                });
            }
        }
        if ($sorts !== []) {
            $query->reorder();
            foreach ($sorts as $key => $direction) {
                $query->orderBy($columns[$key]->field, $direction);
            }
        }
        $query->orderBy($query->getModel()->getQualifiedKeyName());
        $total = $query->toBase()->getCountForPagination();
        $this->page = min(max(1, $this->page), max(1, (int) ceil($total / $this->perPage)));

        return $query->paginate($this->perPage, ['*'], $this->tableId . '_page', $this->page, $total);
    }

    /**
     * @param  Collection<array-key, *>  $source
     * @param  array<string, Column>  $columns
     * @param  array<string, Filter>  $filterDefinitions
     * @param  array<string, 'asc'|'desc'>  $sorts
     * @return LengthAwarePaginator<int, array<array-key, mixed>|object>
     */
    private function collectionRecords(Collection $source, array $columns, array $filterDefinitions, array $sorts): LengthAwarePaginator
    {
        $records = $this->normalizeCollection($source);
        $term = trim($this->search);
        $searchable = array_filter($columns, static fn (Column $column): bool => $column->searchable);
        if ($term !== '' && $searchable !== []) {
            $records = $records->filter(static function (array|object $record) use ($searchable, $term): bool {
                foreach ($searchable as $column) {
                    $value = data_get($record, $column->field);
                    if (is_scalar($value) && mb_stripos((string) $value, $term) !== false) {
                        return true;
                    }
                }

                return false;
            });
        }
        foreach ($filterDefinitions as $filter) {
            $value = $this->filterValue($filter);
            if ($value !== '') {
                $filtered = ($filter->apply)($records, $value);
                if (!$filtered instanceof Collection) {
                    throw new InvalidArgumentException('Collection Table filter callbacks must return a Collection.');
                }
                $records = $this->normalizeCollection($filtered);
            }
        }
        if ($sorts !== []) {
            $comparisons = [];
            foreach ($sorts as $key => $direction) {
                $comparisons[] = [$columns[$key]->field, $direction];
            }
            $comparisons[] = fn (array|object $left, array|object $right): int => $this->recordKey($left) <=> $this->recordKey($right);
            $records = $records->sortBy($comparisons);
        }
        $total = $records->count();
        $this->page = min(max(1, $this->page), max(1, (int) ceil($total / $this->perPage)));

        return new LengthAwarePaginator($records->forPage($this->page, $this->perPage)->values(), $total, $this->perPage, $this->page, [
            'path' => LengthAwarePaginator::resolveCurrentPath(), 'pageName' => $this->tableId . '_page',
        ]);
    }

    /**
     * @param  Collection<array-key, *>  $source
     * @return Collection<int, array<array-key, mixed>|object>
     */
    private function normalizeCollection(Collection $source): Collection
    {
        $keys = [];
        $records = [];
        foreach ($source as $record) {
            if (!is_array($record) && !is_object($record)) {
                throw new InvalidArgumentException('Collection Table records must be arrays or objects.');
            }
            $key = $this->recordKey($record);
            if ($key === '' || isset($keys[(string) $key])) {
                throw new InvalidArgumentException('Collection Table record IDs must be nonempty and unique.');
            }
            $keys[(string) $key] = true;

            $records[] = $record;
        }

        return new Collection($records);
    }

    /**
     * @template T of Column|Filter
     *
     * @param  list<T>  $definitions
     * @return array<string, T>
     */
    private function definitions(array $definitions): array
    {
        $result = [];
        foreach ($definitions as $definition) {
            if (isset($result[$definition->key])) {
                throw new InvalidArgumentException('Table definition keys must be unique.');
            }
            $result[$definition->key] = $definition;
        }

        return $result;
    }

    /**
     * @param  array<string, Column>  $columns
     * @return array<string, 'asc'|'desc'>
     */
    private function validatedSorts(array $columns): array
    {
        $sorts = [];
        foreach ($this->sorts as $key => $direction) {
            abort_unless(is_string($key) && ($columns[$key] ?? null)?->sortable === true
                && in_array($direction, ['asc', 'desc'], true), 422);
            $sorts[$key] = $direction;
        }

        return $sorts;
    }

    private function filterValue(Filter $filter): string
    {
        $value = array_key_exists($filter->key, $this->filters) ? ($this->filters[$filter->key] ?? '') : $filter->default;
        abort_unless(is_string($value) && mb_strlen($value) <= 500, 422);
        abort_unless($filter->type !== 'select' || $filter->searchUrl !== null || $value === '' || array_key_exists($value, $filter->options), 422);
        $format = ['date' => 'Y-m-d', 'time' => 'H:i', 'datetime' => 'Y-m-d H:i:s'][$filter->type] ?? null;
        if ($value !== '' && $format !== null) {
            abort_if(str_contains($value, "\0"), 422);
            $date = DateTimeImmutable::createFromFormat('!' . $format, $value, new DateTimeZone('UTC'));
            abort_unless($date !== false && $date->format($format) === $value, 422);
        }

        return $value;
    }

    /** @return non-empty-list<positive-int> */
    private function validPageSizes(): array
    {
        $sizes = $this->pageSizes();
        if ($sizes === []) {
            throw new InvalidArgumentException('Table requires at least one page size.');
        }
        foreach ($sizes as $size) {
            if ($size < 1) {
                throw new InvalidArgumentException('Page sizes must be positive integers.');
            }
        }

        return $sizes;
    }

    /**
     * @param  LengthAwarePaginator<int, *>  $records
     * @return list<int|null>
     */
    private function pageNumbers(LengthAwarePaginator $records): array
    {
        $candidates = array_unique([1, $records->lastPage(), ...range(max(1, $records->currentPage() - 2), min($records->lastPage(), $records->currentPage() + 2))]);
        sort($candidates);
        $pages = [];
        $previous = 0;
        foreach ($candidates as $number) {
            if ($previous !== 0 && $number > $previous + 1) {
                $pages[] = null;
            }
            $pages[] = $number;
            $previous = $number;
        }

        return $pages;
    }
}
