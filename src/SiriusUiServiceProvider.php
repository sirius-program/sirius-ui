<?php

declare(strict_types=1);

namespace Sirius\Ui;

use Illuminate\Support\Facades\Blade;
use Illuminate\Support\ServiceProvider;
use InvalidArgumentException;
use Livewire\Livewire;

final class SiriusUiServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom(__DIR__ . '/../config/sirius-ui.php', 'sirius-ui');
    }

    public function boot(): void
    {
        $bladeNamespace = $this->componentNamespace('sirius-ui.blade_namespace');
        $livewireNamespace = $this->componentNamespace('sirius-ui.livewire_namespace');

        $this->loadViewsFrom(__DIR__ . '/../resources/views', 'sirius');
        $this->loadTranslationsFrom(__DIR__ . '/../resources/lang', 'sirius');

        Blade::anonymousComponentPath(
            __DIR__ . '/../resources/views/components',
            $bladeNamespace,
        );

        Livewire::addNamespace(
            namespace: $livewireNamespace,
            classNamespace: 'Sirius\\Ui\\Livewire',
            classPath: __DIR__ . '/Livewire',
            classViewPath: __DIR__ . '/../resources/views/livewire',
        );

        $this->publishes([
            __DIR__ . '/../config/sirius-ui.php' => config_path('sirius-ui.php'),
        ], 'sirius-ui-config');

        $this->publishes([
            __DIR__ . '/../resources/views' => resource_path('views/vendor/sirius'),
        ], 'sirius-ui-views');

        $this->publishes([
            __DIR__ . '/../resources/lang' => lang_path('vendor/sirius'),
        ], 'sirius-ui-translations');

        $this->publishes([
            __DIR__ . '/../dist/sirius.css' => public_path('vendor/sirius-ui/sirius.css'),
        ], 'sirius-ui-assets');
    }

    private function componentNamespace(string $key): string
    {
        $namespace = config($key);

        if (!is_string($namespace) || $namespace === '') {
            throw new InvalidArgumentException("The [{$key}] configuration value must be a non-empty string.");
        }

        return $namespace;
    }
}
