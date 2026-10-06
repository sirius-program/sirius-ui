<?php

declare(strict_types=1);

namespace Sirius\Ui\Livewire;

use Illuminate\Support\Str;
use Illuminate\View\View;
use InvalidArgumentException;
use Livewire\Attributes\Locked;
use Livewire\Attributes\Reactive;
use Livewire\Component;
use Sirius\Ui\Support\ChartOptions;

class Chart extends Component
{
    #[Locked]
    public string $chartId;

    #[Reactive]
    public string $type = 'bar';

    /** @var array<string, mixed> */
    #[Reactive]
    public array $data = ['labels' => [], 'datasets' => []];

    /** @var array<string, mixed> */
    #[Reactive]
    public array $options = [];

    #[Reactive]
    public ?string $label = null;

    #[Reactive]
    public ?string $description = null;

    #[Reactive]
    public ?int $width = null;

    #[Reactive]
    public ?int $height = null;

    #[Reactive]
    public bool $loading = false;

    public function mount(?string $id = null): void
    {
        $this->chartId = $id ?? Str::random(5);
        if (!preg_match('/^[a-zA-Z0-9_-]+$/D', $this->chartId)) {
            throw new InvalidArgumentException('Chart requires a safe ID.');
        }
    }

    public function render(): View
    {
        $label = $this->label ?? __('sirius::sirius-ui.chart.label');
        if ($label === '') {
            throw new InvalidArgumentException('Chart requires a nonempty accessible label.');
        }

        return view('sirius::livewire.chart', [
            'payload'         => ChartOptions::validate($this->type, $this->data, $this->options, $this->width, $this->height),
            'accessibleLabel' => $label,
        ]);
    }
}
