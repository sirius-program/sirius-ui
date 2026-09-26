<?php

declare(strict_types=1);

use Illuminate\Foundation\Application;
use Illuminate\Support\Facades\Blade;

it('keeps bootstrap manifests and compiled views in the current process runtime', function (): void {
    $app = app(Application::class);
    $runtime = dirname($app->bootstrapPath());
    expect($runtime)->toStartWith(dirname(__DIR__, 2) . '/.phpunit.cache/runtime/' . getmypid() . '-')
        ->and($app->getCachedServicesPath())->toBe($runtime . '/bootstrap' . DIRECTORY_SEPARATOR . 'cache/services.php')
        ->and($app->getCachedPackagesPath())->toBe($runtime . '/bootstrap' . DIRECTORY_SEPARATOR . 'cache/packages.php')
        ->and(config('view.compiled'))->toBe($runtime . '/views');

    expect(Blade::render('<x-sirius::label>Runtime</x-sirius::label>'))->toContain('Runtime');
    expect(is_file($app->getCachedServicesPath()))->toBeTrue()
        ->and(glob($runtime . '/views/*.php'))->not->toBeEmpty();
});
