# Sirius UI

Laravel Blade and Livewire UI components styled with Tailwind CSS. Use them in ordinary Blade forms or reactive Livewire views, with bundled widgets and light/dark themes.

See the [documentation project](https://github.com/sirius-program/sirius-ui-docs#readme) for demos and component guides.

## Table of Contents

- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Loading Assets](#loading-assets)
- [Basic Usage](#basic-usage)
- [Core Components](#core-components)
- [Configuration and Translations](#configuration-and-translations)
- [AI Assistance](#ai-assistance)
- [Development](#development)
- [License](#license)

## Features

- Form controls with labels, helper text, validation messages, and Livewire bindings.
- Formatted currency, international phone numbers, searchable selects, date/time pickers, and sliders.
- File uploads with image/PDF previews and a separate Richtext component with Tiptap UI and optional image uploads.
- Layout, navigation, overlays, and notifications with keyboard and focus handling.
- Livewire Table with Eloquent/Collection sources, sorting, filters, selection, and external row/bulk actions.
- FullCalendar Standard scheduling and Chart.js charts.
- Compiled CSS/JavaScript, publishable configuration/translations, and a bundled development skill for AI agents.

Enhanced widgets ship with the package. Richtext includes its React runtime; consumers do not need a separate Tiptap installation, React setup, CDN, or API key.

## Requirements

| Dependency | Supported versions |
| --- | --- |
| PHP | `^8.3` |
| Laravel components | `^12.61.1` or `^13.12.0` |
| Livewire | `^4.0` |

Blade Heroicons `2.7.0` is installed through Composer. JavaScript is required for enhanced widgets and interactive components.

## Installation

```bash
composer require sirius/ui
```

Laravel discovers the service provider automatically. The default Blade namespace is `x-sirius::`; the default Livewire namespace is `sirius`.

## Loading Assets

Choose one asset strategy and load the package assets once.

### Vite

In `resources/css/app.css`:

```css
@import '../../vendor/sirius/ui/dist/sirius.css';
```

In `resources/js/app.js`:

```javascript
import '../../vendor/sirius/ui/dist/sirius.js';
```

Load your application entries in the layout and build them:

```blade
@vite(['resources/css/app.css', 'resources/js/app.js'])
```

```bash
npm run build
```

### Published Assets

For applications without a bundler:

```bash
php artisan vendor:publish --tag=sirius-ui-assets
```

Load the published files in your layout:

```blade
<link rel="stylesheet" href="{{ asset('vendor/sirius-ui/sirius.css') }}">
<script src="{{ asset('vendor/sirius-ui/sirius.js') }}" defer></script>
```

Republish assets after package upgrades. For Livewire views, keep Livewire's own assets enabled and use its bundled Alpine runtime.

## Basic Usage

### Blade

Define a `projects.store` route and handle validation and persistence in your application:

```blade
<x-sirius::card header="New project">
    <x-sirius::form :action="route('projects.store')" method="POST" class="space-y-4">
        <x-sirius::input
            id="project-name"
            name="name"
            label="Project name"
            :value="old('name')"
            required
        />

        <x-sirius::currency
            id="project-budget"
            name="budget"
            label="Budget"
            prefix="$"
            :value="old('budget')"
        />

        <x-sirius::button type="submit" variant="primary">Save project</x-sirius::button>
    </x-sirius::form>
</x-sirius::card>
```

See each component's dedicated documentation page for detailed API and usage examples.

### Livewire

Inside a Livewire component with a public `$name` property and a `save()` method:

```blade
<form wire:submit="save" class="space-y-4">
    <x-sirius::input
        id="livewire-project-name"
        wire:model="name"
        label="Project name"
        required
    />

    <x-sirius::button type="submit" variant="primary">Save project</x-sirius::button>
</form>
```

See each component's dedicated documentation page for detailed API and usage examples.

## Core Components

| Group | Components |
| --- | --- |
| Forms and fields | Form, Field, Label, Input/password, Textarea, Checkbox, Radio, Switch, Currency, Datetime Picker, Phone, Select, File Upload, Richtext, Slider |
| Presentation | Code, Link, Icon, Avatar, Badge, Button, Button Group, Message, Separator, Skeleton |
| Layout | Card, Accordion, Tabs, Timeline |
| Navigation | Breadcrumb, Menu, Dropdown |
| Overlays and notifications | Dialog, Alert, Slideover, Toast, Popover, Tooltip |
| Livewire data components | Table, Calendar, Chart |

Menu supports titled `menu.category` sections and `menu.item` submenus with optional icons. Put nested items in `<x-slot:submenu>` to create collapsible sections, with `open` for initial/bound state and `transition` for opening animations; closing hides the submenu immediately. Submenu items use compact triggers and indented content with a vertical border by default. Components own the list markup.

Blade component names use kebab case, for example `<x-sirius::datetime-picker>`, `<x-sirius::file-upload>`, and `<x-sirius::button-group>`.

Extend `Sirius\Ui\Livewire\Table` and implement `query()` and `columns()`; add `filters()` when needed. Extend `Sirius\Ui\Livewire\Calendar` and implement `events()`. Mount the concrete Chart component in a Livewire view:

```blade
<livewire:sirius::chart
    id="revenue-chart"
    type="bar"
    :data="$chartData"
    label="Monthly revenue"
/>
```

Table row/bulk buttons can open application-defined Dialogs, Alerts, or Slideovers, or link to pages. Your application owns authorization, queries, persistence, and Calendar actions. Upload endpoints and server-side Richtext sanitization also belong to your application.

## Configuration and Translations

Publish only the resources you want to customize:

```bash
php artisan vendor:publish --tag=sirius-ui-config
php artisan vendor:publish --tag=sirius-ui-translations
php artisan vendor:publish --tag=sirius-ui-views
```

`config/sirius-ui.php` configures Blade/Livewire namespaces, locale, timezone, phone country, currency separators/precision, and Toast position/duration. Toast defaults to `top-end` and 5000 milliseconds; a duration of zero keeps it visible until closed.

| Setting | Fallback order |
| --- | --- |
| Locale | Explicit setting → `sirius-ui.locale` → `app.locale` → `app.fallback_locale` → `en` |
| Timezone | Explicit setting → `sirius-ui.timezone` → `app.timezone` → `UTC` |
| Phone country | `country` prop → `sirius-ui.phone_country` → `sirius-ui.locale` → `app.locale` → `app.fallback_locale` → `US` |

UI strings are grouped by component in `lang/vendor/sirius/{locale}/sirius-ui.php`. Validation rule messages use `lang/vendor/sirius/{locale}/validation.php`. English translations are included; add other locale directories for your application. Richtext uses translation strings and has no `locale` prop.

Add the `dark` class to your layout's root element for the dark theme. Add `sir-scrollbar` to `html` or a scroll container for the package's scrollbar styling. Load CSS overrides after Sirius CSS. Published views should be reviewed when upgrading.

## AI Assistance

The bundled `sirius-ui-development` skill gives coding agents package-specific guidance and offline API references. It is a development aid, not an AI service running inside your application.

For project-local installation:

```bash
php artisan sirius:skills:install --agent=codex
php artisan sirius:skills:install --agent=claude-code
```

Use `--dry-run` to preview changes. Re-run the command after upgrading the package; customized skill files require confirmation before replacement.

If your project uses Laravel Boost, select `sirius/ui` under Agent Skills during `php artisan boost:install`, then use `php artisan boost:update` after upgrades. Use either Boost or standalone installation for a given skill directory.

## Development

From a package checkout:

```bash
composer install
npm ci
npm run build
composer test
```

Commit generated changes in `dist/` and `resources/data/`. Consumers use the compiled distribution and do not need the package's frontend build dependencies. See the [changelog](CHANGELOG.md) for release changes and the [issue tracker](https://github.com/sirius-program/sirius-ui/issues) for bug reports.

## License

Sirius UI is licensed under the [MIT license](LICENSE.md). Bundled dependency notices are included in `dist/third-party-notices.txt` and published with the assets.
