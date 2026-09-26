<?php

declare(strict_types=1);

namespace Tests;

use BladeUI\Heroicons\BladeHeroiconsServiceProvider;
use BladeUI\Icons\BladeIconsServiceProvider;
use Illuminate\Filesystem\Filesystem;
use Illuminate\Foundation\Application;
use Livewire\LivewireServiceProvider;
use Orchestra\Testbench\TestCase as Orchestra;
use Sirius\Ui\SiriusUiServiceProvider;

abstract class TestCase extends Orchestra
{
    private static ?string $runtimePath = null;

    protected function resolveApplication(): Application
    {
        $app = parent::resolveApplication();
        $app->useBootstrapPath($this->runtimePath() . '/bootstrap');

        return $app;
    }

    private function runtimePath(): string
    {
        if (self::$runtimePath === null) {
            // Isolate concurrent workers and separate runs, including direct Pest invocations.
            self::$runtimePath = dirname(__DIR__) . '/.phpunit.cache/runtime/' . getmypid() . '-' . bin2hex(random_bytes(8));
            $files = new Filesystem;
            $files->ensureDirectoryExists(self::$runtimePath . '/bootstrap/cache');
            $files->ensureDirectoryExists(self::$runtimePath . '/views');
        }

        return self::$runtimePath;
    }

    /**
     * @return array<int, class-string>
     */
    protected function getPackageProviders($app): array
    {
        return [
            BladeIconsServiceProvider::class,
            BladeHeroiconsServiceProvider::class,
            LivewireServiceProvider::class,
            SiriusUiServiceProvider::class,
        ];
    }

    protected function defineEnvironment($app): void
    {
        $app['config']->set('view.compiled', $this->runtimePath() . '/views');
        $app['config']->set('app.key', 'base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=');
    }
}
