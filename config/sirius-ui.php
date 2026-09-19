<?php

declare(strict_types=1);

return [
    'blade_namespace'    => 'sirius',
    'livewire_namespace' => 'sirius',

    // Locale priority: sirius-ui.locale > app.locale > app.fallback_locale > 'en'.
    'locale' => env('SIRIUS_UI_LOCALE', env('APP_LOCALE', env('APP_FALLBACK_LOCALE'))),

    // Timezone priority: sirius-ui.timezone > app.timezone > 'UTC'.
    'timezone' => env('SIRIUS_UI_TIMEZONE', env('APP_TIMEZONE')),

    'currency' => [
        'thousands_separator' => env('SIRIUS_UI_CURRENCY_THOUSANDS_SEPARATOR', ','),
        'precision'           => env('SIRIUS_UI_CURRENCY_PRECISION', 2),
        'decimal_separator'   => env('SIRIUS_UI_CURRENCY_DECIMAL_SEPARATOR', '.'),
    ],
];
