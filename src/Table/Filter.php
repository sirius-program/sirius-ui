<?php

declare(strict_types=1);

namespace Sirius\Ui\Table;

use Closure;
use InvalidArgumentException;

final readonly class Filter
{
    /**
     * Builder callbacks modify the query; Collection callbacks return the filtered collection.
     *
     * @param  array<array-key, string>  $options
     */
    public function __construct(
        public string $key,
        public string $label,
        public Closure $apply,
        public string $type = 'text',
        public array $options = [],
        public string $default = '',
        public ?string $searchUrl = null,
    ) {
        if (!preg_match('/^[a-zA-Z_][a-zA-Z0-9_]*$/D', $key) || trim($label) === ''
            || !in_array($type, ['text', 'select', 'date', 'time', 'datetime'], true)
            || ($searchUrl !== null && ($type !== 'select' || trim($searchUrl) === ''))
            || ($type === 'select' && $searchUrl === null && $default !== '' && !array_key_exists($default, $options))) {
            throw new InvalidArgumentException('Filters require a key, label, supported type, valid default, and an optional select search URL.');
        }
        foreach ($options as $value => $text) {
            if ((string) $value === '' || trim($text) === '') {
                throw new InvalidArgumentException('Filter options require nonempty values and labels.');
            }
        }
    }

    /** @return list<array{value: string, label: string}> */
    public function selectOptions(): array
    {
        $options = [];
        foreach ($this->options as $value => $label) {
            $options[] = ['value' => (string) $value, 'label' => $label];
        }

        return $options;
    }
}
