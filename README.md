# Sirius UI

Sirius UI is a reusable Laravel package for Blade and class-based Livewire components styled with Tailwind CSS.

## Requirements

- PHP 8.3 or later
- Laravel 12.61.1 or later, or Laravel 13.12.0 or later
- Livewire 4
- Tailwind CSS 4 when compiling the source stylesheet

## Installation

Install the package through Composer:

```bash
composer require sirius/ui
```

Laravel discovers the package service provider automatically.

### Styles

For a Tailwind-aware application build, import the source stylesheet from your application's `resources/css/app.css`:

```css
@import "../../vendor/sirius/ui/resources/css/sirius.css";
```

Alternatively, import the precompiled stylesheet:

```css
@import "../../vendor/sirius/ui/dist/sirius.css";
```

The stylesheet intentionally excludes Tailwind Preflight. Public component classes use the `sir-` prefix and design tokens use the `--sir-` prefix.

You may also publish the compiled asset:

```bash
php artisan vendor:publish --tag=sirius-ui-assets
```

## Adding components

The package intentionally ships without built-in UI components. Add anonymous Blade components to `resources/views/components` and class-based Livewire components to `src/Livewire`, with their views in `resources/views/livewire`.

Components added to those directories are exposed through the configured namespaces:

```blade
<x-sirius::component-name />
<livewire:sirius::component-name />
```

## Configuration and customization

Publish the package configuration, views, or translations when an application needs to override them:

```bash
php artisan vendor:publish --tag=sirius-ui-config
php artisan vendor:publish --tag=sirius-ui-views
php artisan vendor:publish --tag=sirius-ui-translations
```

The default Blade and Livewire namespaces are both `sirius`. They can be changed in the published `config/sirius-ui.php` file if an application has a namespace collision.

Override design tokens in application CSS:

```css
:root {
    --sir-color-primary: oklch(0.55 0.2 260);
    --sir-radius: 0.625rem;
}

.dark {
    --sir-color-surface: oklch(0.2 0.02 260);
    --sir-color-text: oklch(0.96 0.01 260);
}
```

## Development

Install dependencies and build the stylesheet:

```bash
composer install
npm install
npm run build
```

Run the quality checks:

```bash
composer check
```

Component previews belong in the separate `sirius-ui-docs` project; this package does not provide preview routes or pages.

## License

Sirius UI is open-source software licensed under the [MIT license](LICENSE.md).
