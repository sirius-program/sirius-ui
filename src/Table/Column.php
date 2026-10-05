<?php

declare(strict_types=1);

namespace Sirius\Ui\Table;

use Closure;
use InvalidArgumentException;

final readonly class Column
{
    public string $field;

    public function __construct(
        public string $key,
        public string $label,
        ?string $field = null,
        public bool $searchable = false,
        public bool $sortable = false,
        public ?string $view = null,
        public ?Closure $format = null,
    ) {
        $this->field = $field ?? $key;

        if (!preg_match('/^[a-zA-Z_][a-zA-Z0-9_]*$/D', $key)
            || !preg_match('/^[a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*$/D', $this->field)
            || trim($label) === '' || $view === '') {
            throw new InvalidArgumentException('Columns require a unique key, label, safe query field, and an optional nonempty view name.');
        }
    }

    /** @param array<array-key, mixed>|object $record */
    public function displayValue(array|object $record): mixed
    {
        $value = data_get($record, $this->key);

        return $this->format instanceof Closure ? ($this->format)($value, $record) : $value;
    }
}
