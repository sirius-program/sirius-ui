# Setup and boundaries

## Inspect the installed release

Use composer show sirius/ui, composer show livewire/livewire and composer show laravel/framework. This bundle travels with the package release; refresh the installed skill after upgrading. The package requires PHP ^8.3, Laravel components ^12.61.1 or ^13.12.0, Livewire ^4.0 and Blade Heroicons 2.7.0. Resolve actual Composer constraints before changing dependencies.

Public source: resources/views/components (Blade), src/View/Components/Field, src/Livewire/{Table,Calendar,Chart}, src/Table/{Column,Filter}, config/sirius-ui.php and resources/lang/{locale}. dist contains precompiled assets and notices. Internal partials, floating and navigation-item are implementation details. Extend Table/Calendar in app/Livewire; Chart is a concrete component.

Namespaces default to Blade sirius and Livewire sirius, configurable via sirius-ui.namespace.blade/livewire. Translation and view namespaces stay sirius.

## Install assets

Use one asset strategy. For Vite, import vendor/sirius/ui/dist/sirius.css in application CSS and vendor/sirius/ui/dist/sirius.js in application JavaScript, then build the application assets. Load Livewire's own assets once; do not add another Alpine runtime.

Alternatively publish prebuilt assets:
```shell
php artisan vendor:publish --tag=sirius-ui-assets
```
Load public/vendor/sirius-ui/sirius.css and sirius.js from the application layout. Republish assets after upgrades. npm ci and npm run build are for developing the package; consumers can use dist without rebuilding Sirius.

Explicit optional publishing:
```shell
php artisan vendor:publish --tag=sirius-ui-config
php artisan vendor:publish --tag=sirius-ui-translations
php artisan vendor:publish --tag=sirius-ui-views
```
Avoid force-publishing over customized files; compare changes first. Published views need maintenance on upgrades.

## Configuration and translations

Explicit component locale/timezone wins. Runtime defaults:
- timezone: sirius-ui.timezone â†’ app.timezone â†’ UTC
- locale: sirius-ui.locale â†’ app.locale â†’ app.fallback_locale â†’ en
- phone country: sirius-ui.phone_country â†’ sirius-ui.locale â†’ app.locale â†’ app.fallback_locale â†’ US

Currency global thousands_separator, decimal_separator and precision default to comma, period and 2. Toast position/duration default top-end/5000 ms. Set overrides in published config; environment lookup belongs in configuration, never component classes.

UI translations: sirius::sirius-ui.{component}.{key}, stored in resources/lang/{locale}/sirius-ui.php. Consumers override lang/vendor/sirius/{locale}/sirius-ui.php. Validation messages: sirius::validation.* in validation.php. JavaScript receives translated strings from Blade. Dialog, Alert, Slideover and Toast share dialog.close. Richtext has no locale prop.

Currency validity text uses the currency group with :precision, :min and :max tokens. Datetime Picker validity, Clear, and its fallback accessible name use datetime-picker. These UI strings follow the application's translation locale; the picker locale prop separately chooses the calendar's month/day names.

Password toggle labels use input.show_password/hide_password. Phone country labels and client feedback use the phone group. Explicit show-label/hide-label and country-label/invalid-message props override those translations.

## Themes and icons

Add `sir-scrollbar` to a scroll container or the layout's `html` element to style its scrollbars and descendants. The native scrollbar uses a thin rounded thumb and light/dark colors; it retains system styling in forced-colors mode. Override `--sir-scrollbar-size`, `--sir-scrollbar-track`, `--sir-scrollbar-thumb`, and `--sir-scrollbar-thumb-hover` after Sirius CSS. Browsers without WebKit scrollbar selectors use standard thin/color styling instead of exact pixel sizing and hover colors.

Load overrides after Sirius CSS. .dark activates the dark theme; follow the application's theme persistence. Inspect resources/css/sirius.css for available --sir-* tokens and per-variant tone styles. Example in recipes.md. --sir-color-primary is used by interactive widgets; semantic button/badge tones have their own rules, so verify the intended component rather than assuming one token changes all variants.

Use x-sirius::icon name="heroicon-o-clock"; label makes the icon meaningful to assistive technology, otherwise it is decorative. Heroicons are bundled through Blade Icons; use valid installed icon names. Clear compiled views/icon cache after an environment mismatch with php artisan view:clear and php artisan icons:clear. Do not edit vendor.

## Verification and troubleshooting

Use application composer test if defined, otherwise php artisan test --compact; run browser tests for widget interaction. Package contributors use composer test and npm run build; docs use composer test followed by composer test:browser.

Missing styling/widgets: verify layout imports, rebuild Vite or republish assets, clear views and check browser errors. Native control appearing after Livewire updates: verify compatible published views and current assets before adding manual initialization. Keep IDs unique/stable and avoid conditional replacement of an active widget. Hidden widgets inside Tabs/Dialog/Slideover resize through Sirius lifecycle hooks.

Boost installs this bundle from resources/boost/skills/sirius-ui-development. Select sirius/ui in boost:install and use boost:update to refresh. Standalone users run sirius:skills:install with --agent=codex or --agent=claude-code; --dry-run previews paths. Do not mix owners. Boost customizations belong in a complete .ai/skills/sirius-ui-development bundle. Standalone conflicts require interactive confirmation; originals are backed up inside the selected skill folder.
