<?php

declare(strict_types=1);

namespace Sirius\Ui\View\Components;

use Illuminate\Support\Arr;
use Illuminate\Support\Facades\View;
use Illuminate\Support\Str;
use Illuminate\Support\ViewErrorBag;
use Illuminate\View\Component;
use Illuminate\View\ComponentAttributeBag;
use Illuminate\View\View as BladeView;
use InvalidArgumentException;
use LogicException;

final class Field extends Component
{
    public string $id;

    public function __construct(
        ?string $id = null,
        public ?string $label = null,
        public ?string $name = null,
        public ?string $helper = null,
        public bool $required = false,
        public bool $disabled = false,
        public bool $readonly = false,
        public ?string $errorKey = null,
        public string $errorBag = 'default',
        public ?ViewErrorBag $errors = null,
        public string $layout = 'stacked',
        public string $size = 'md',
        public bool $group = false,
        public string $wrapperClass = '',
        public bool $showRequiredIndicator = true,
        public bool $showErrors = true,
        public ?string $labelStatus = null,
    ) {
        $this->id = $id ?? Str::random(5);

        if ($this->id === '' || preg_match('/[\s"\'<>`=]/u', $this->id)) {
            throw new InvalidArgumentException('A field needs a non-empty, unique ID without whitespace or markup characters.');
        }

        if (!in_array($layout, ['stacked', 'inline'], true) || !in_array($size, ['sm', 'md', 'lg'], true)) {
            throw new InvalidArgumentException('Field layout must be stacked or inline; size must be sm, md, or lg.');
        }
    }

    public function resolvedErrorKey(): ?string
    {
        if ($this->errorKey !== null) {
            return $this->errorKey;
        }

        foreach ($this->attributes->getAttributes() as $attribute => $value) {
            if (($attribute === 'wire:model' || str_starts_with($attribute, 'wire:model.')) && is_string($value)) {
                return $value;
            }
        }

        return $this->name === null ? null : trim(str_replace(['[', ']'], ['.', ''], $this->name), '.');
    }

    /** @return list<string> */
    public function messages(): array
    {
        $errors = $this->errors ?? View::shared('errors');
        $key = $this->resolvedErrorKey();

        if (!$errors instanceof ViewErrorBag || $key === null || $key === '') {
            return [];
        }

        return array_values(array_filter(Arr::flatten($errors->getBag($this->errorBag)->get($key)), is_string(...)));
    }

    /** @return array{required: bool, key: ?string, bag: string, errors: ?ViewErrorBag, description: ?string}|null */
    public function choiceGroup(): ?array
    {
        if (!$this->group) {
            return null;
        }

        $errors = $this->errors ?? View::shared('errors');

        return [
            'required'    => $this->required,
            'key'         => $this->resolvedErrorKey(),
            'bag'         => $this->errorBag,
            'errors'      => $errors instanceof ViewErrorBag ? $errors : null,
            'description' => $this->describedBy(),
        ];
    }

    public function describedBy(): ?string
    {
        $existing = $this->attributes->get('aria-describedby');
        $ids = is_string($existing) ? preg_split('/\s+/', trim($existing)) : [];
        $ids = $ids ?: [];

        if ($this->helper !== null && $this->helper !== '') {
            $ids[] = $this->id . '-helper';
        }

        if ($this->showErrors && $this->messages() !== []) {
            $ids[] = $this->id . '-error';
        }

        $value = implode(' ', array_unique(array_filter($ids)));

        return $value === '' ? null : $value;
    }

    public function controlAttributes(): ComponentAttributeBag
    {
        if ($this->group) {
            throw new LogicException('Group fields contain individually named and labelled controls; do not reuse one control attribute bag for the group.');
        }

        return $this->attributes->except(['aria-describedby', 'aria-invalid'])->merge([
            'id'               => $this->id,
            'name'             => $this->name,
            'required'         => $this->required,
            'disabled'         => $this->disabled,
            'readonly'         => $this->readonly,
            'aria-describedby' => $this->describedBy(),
            'aria-invalid'     => $this->messages() !== [] ? 'true' : 'false',
            'class'            => 'sir-control',
        ]);
    }

    public function render(): BladeView
    {
        return view('sirius::components.field');
    }
}
