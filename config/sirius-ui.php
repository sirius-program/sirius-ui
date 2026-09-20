<?php

declare(strict_types=1);

return [
    'blade_namespace'    => 'sirius',
    'livewire_namespace' => 'sirius',

    // Priority: sirius-ui.locale > app.locale > app.fallback_locale > 'en'.
    'locale' => env('SIRIUS_UI_LOCALE', env('APP_LOCALE', env('APP_FALLBACK_LOCALE'))),

    // Priority: sirius-ui.timezone > app.timezone > 'UTC'.
    'timezone' => env('SIRIUS_UI_TIMEZONE', env('APP_TIMEZONE')),

    // Priority: sirius-ui.phone_country > sirius-ui.locale > app.locale > app.fallback_locale > 'US'.
    'phone_country' => env('SIRIUS_UI_PHONE_COUNTRY', env('SIRIUS_UI_LOCALE', env('APP_LOCALE', env('APP_FALLBACK_LOCALE')))),

    'currency' => [
        'thousands_separator' => env('SIRIUS_UI_CURRENCY_THOUSANDS_SEPARATOR', ','),
        'precision'           => env('SIRIUS_UI_CURRENCY_PRECISION', 2),
        'decimal_separator'   => env('SIRIUS_UI_CURRENCY_DECIMAL_SEPARATOR', '.'),
    ],
];
