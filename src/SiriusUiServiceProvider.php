<?php

declare(strict_types=1);

namespace Sirius\Ui;

use Illuminate\Support\Facades\Blade;
use Illuminate\Support\ServiceProvider;
use InvalidArgumentException;
use Livewire\Livewire;
use Sirius\Ui\Console\InstallSkillCommand;
use Sirius\Ui\View\Components\Field;

final class SiriusUiServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom(__DIR__ . '/../config/sirius-ui.php', 'sirius-ui');
    }

    public function boot(): void
    {
        if ($this->app->runningInConsole()) {
            $this->commands([InstallSkillCommand::class]);
        }

        $bladeNamespace = $this->componentNamespace('sirius-ui.namespace.blade');
        $livewireNamespace = $this->componentNamespace('sirius-ui.namespace.livewire');

        $this->loadViewsFrom(__DIR__ . '/../resources/views', 'sirius');
        $this->loadTranslationsFrom(__DIR__ . '/../resources/lang', 'sirius');

        Blade::anonymousComponentPath(
            __DIR__ . '/../resources/views/components',
            $bladeNamespace,
        );

        Blade::component(Field::class, $bladeNamespace . '::field');
        Blade::component(Field::class, 'sirius-internal-field');
        Blade::component('sirius::components.label', 'sirius-internal-label');
        Blade::component('sirius::components.icon', 'sirius-internal-icon');
        Blade::component('sirius::components.dialog', 'sirius-internal-dialog');
        Blade::component('sirius::components.navigation-item', 'sirius-internal-navigation-item');
        Blade::component('sirius::components.floating', 'sirius-internal-floating');
        Blade::component('sirius::components.button', 'sirius-internal-button');
        Blade::component('sirius::components.dropdown', 'sirius-internal-dropdown');
        Blade::component('sirius::components.input', 'sirius-internal-input');
        Blade::component('sirius::components.checkbox', 'sirius-internal-checkbox');
        Blade::component('sirius::components.select', 'sirius-internal-select');
        Blade::component('sirius::components.datetime-picker', 'sirius-internal-datetime-picker');

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
            __DIR__ . '/../dist/sirius.css'              => public_path('vendor/sirius-ui/sirius.css'),
            __DIR__ . '/../dist/sirius.js'               => public_path('vendor/sirius-ui/sirius.js'),
            __DIR__ . '/../dist/third-party-notices.txt' => public_path('vendor/sirius-ui/third-party-notices.txt'),
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
