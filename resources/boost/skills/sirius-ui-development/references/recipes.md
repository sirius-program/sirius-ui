# Consumer recipes

These small examples use ordinary Laravel and shipped Sirius APIs. They are intentionally independent of the docs app. Replace session-backed sample records with scoped application repositories for production; authorization and persistence belong to the consumer.

## Validated Livewire form

Create app/Livewire/ProjectForm.php:
```php
<?php

declare(strict_types=1);

namespace App\Livewire;

use Illuminate\View\View;
use Livewire\Component;

class ProjectForm extends Component
{
    public string $title = '';
    public ?string $budget = null;

    public function save(): void
    {
        $validated = $this->validate([
            'title' => ['required', 'string', 'max:120'],
            'budget' => ['nullable', 'numeric', 'min:0'],
        ]);
        // Authorize and persist $validated through the application's service here.
        $this->dispatch('toast:show', id: 'project-saved');
    }

    public function clearForm(): void
    {
        $this->reset('title', 'budget');
        $this->resetValidation();
    }

    public function render(): View
    {
        return view('livewire.project-form');
    }
}
```

Create resources/views/livewire/project-form.blade.php:
```blade
<div>
    <form wire:submit="save" class="space-y-4">
        <x-sirius::input id="project-title" wire:model="title" label="Project title"
            helper="Use a short project name." required />
        <x-sirius::currency id="project-budget" wire:model="budget" label="Budget" prefix="$" />
        <x-sirius::button type="submit">Save</x-sirius::button>
        <x-sirius::button wire:click="clearForm">Reset</x-sirius::button>
    </form>
    <x-sirius::toast id="project-saved" title="Saved" text="The project was saved." variant="success" />
</div>
```

Mount with <livewire:project-form />. Validation uses the default error bag and wire:model keys automatically. When adding an actual write, authorize before persisting and notify only after success.

For native Blade submissions use a controller/Form Request with the same rules:
```blade
<x-sirius::form :action="route('projects.store')" method="POST">
    <x-sirius::input id="native-project-title" name="title" label="Project title"
        :value="old('title')" error-bag="project" required />
    <x-sirius::button type="submit">Save</x-sirius::button>
</x-sirius::form>
```
Define the named route and controller in the application; return validation errors in the project bag. Do not flash passwords.

## Theme override

Append after the Sirius CSS import:
```css
:root {
    --sir-radius: 0.75rem;
    --sir-focus-ring: #6366f1;
}
.dark {
    --sir-color-surface: #111827;
    --sir-color-border: #475569;
}
```
Apply .dark on the application's theme root. Verify both themes and focus contrast. Semantic tone classes are separate from these structural tokens.

## Scoped Collection Table

Create app/Livewire/ProjectTable.php; this sample uses session-backed records to keep the example portable. Authenticated applications can seed session projects with id, owner_id and title. Never use client-supplied owner IDs to define scope.
```php
<?php

declare(strict_types=1);

namespace App\Livewire;

use Illuminate\Support\Collection;
use Sirius\Ui\Livewire\Table;
use Sirius\Ui\Table\Column;
use Sirius\Ui\Table\Filter;

class ProjectTable extends Table
{
    protected function query(): Collection
    {
        abort_unless(auth()->check(), 403);

        return collect(session('projects', []))
            ->where('owner_id', auth()->id())
            ->values();
    }

    protected function columns(): array
    {
        return [
            new Column('title', 'Project', searchable: true, sortable: true,
                format: static fn ($value, $record): string => strtoupper((string) $value)),
        ];
    }

    protected function filters(): array
    {
        return [
            new Filter('title', 'Project name',
                static fn (Collection $rows, string $value): Collection => $rows
                    ->filter(static fn ($record): bool => str_contains(
                        strtolower((string) data_get($record, 'title')), strtolower($value)
                    )),
            ),
        ];
    }

    protected function pageSizes(): array
    {
        return [10, 20, 50];
    }
}
```
Mount <livewire:project-table id="projects" record-label="projects" />. For database records return Invoice::query()->where('owner_id', auth()->id()) from a Builder|Collection query() instead; declare the actual model import and schema. SQL filter callbacks modify the Builder, whereas Collection callbacks return a Collection. No persistence occurs inside Table.

## Calendar action and acknowledgment

Create app/Livewire/ProjectCalendar.php. The session schedule contains arrays with id, owner_id, title, start, end and allDay=false. This sample handles timed, non-recurring entries; implement separate all-day and recurrence policies before enabling them.
```php
<?php

declare(strict_types=1);

namespace App\Livewire;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Validator;
use Sirius\Ui\Livewire\Calendar;

class ProjectCalendar extends Calendar
{
    protected function events(CarbonImmutable $start, CarbonImmutable $end, string $timezone): iterable
    {
        abort_unless(auth()->check(), 403);

        return collect(session('schedule', []))
            ->where('owner_id', auth()->id())
            ->filter(static fn (array $event): bool =>
                CarbonImmutable::parse($event['start'])->lt($end)
                && CarbonImmutable::parse($event['end'])->gt($start))
            ->values()->all();
    }

    protected function onEventClick(array $context): void
    {
        $this->dispatch('project:review', recordId: $context['eventId']);
        $this->dispatch('dialog:show', id: 'schedule-review');
    }

    protected function onEventDrop(array $context): bool
    {
        abort_unless(auth()->check(), 403);
        $records = collect(session('schedule', []));
        $record = $records->first(static fn (array $event): bool =>
            $event['id'] === $context['eventId'] && $event['owner_id'] === auth()->id());
        abort_unless($record !== null, 403);
        if (($record['allDay'] ?? false) || ($context['new']['allDay'] ?? false)) {
            return false;
        }
        $span = Validator::make($context['new'], [
            'start' => ['required', 'date'],
            'end' => ['required', 'date', 'after:start'],
        ])->validate();
        session()->put('schedule', $records->map(
            static fn (array $event): array => $event['id'] === $context['eventId']
                && $event['owner_id'] === auth()->id()
                ? array_replace($event, $span) : $event
        )->all());

        return true;
    }
}
```
Mount <livewire:project-calendar id="schedule" :editable="true" />. Render a separate x-sirius::dialog id="schedule-review" in the owner view, and re-query/authorize the selected record in the application handler before displaying protected data. Return true only after a real persistence success; false rejects and rolls back. Use a transaction and scoped model lookup when replacing session storage with a database.
