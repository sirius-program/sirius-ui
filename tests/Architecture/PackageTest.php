<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;
use Livewire\Component;
use Symfony\Component\Finder\Finder;

arch('production code stays independent of consuming applications and tests', function (): void {
    expect('Sirius\Ui')->not->toUse(['App', 'Tests', 'Database', 'Livewire\Flux']);
});

arch('production PHP uses strict types and no debugging or environment helpers', function (): void {
    expect('Sirius\Ui')->toUseStrictTypes();
    expect('Sirius\Ui')->not->toUse(['dd', 'dump', 'die', 'exit', 'var_dump', 'print_r', 'env', 'getenv', 'putenv']);
});

arch('Livewire classes inherit the framework component directly or indirectly', function (): void {
    expect('Sirius\Ui\Livewire')->classes()->toExtend(Component::class);
});

arch('class-backed Blade adapters extend the framework component without querying models', function (): void {
    expect('Sirius\Ui\View\Components')->classes()->toExtend(Illuminate\View\Component::class);
    expect('Sirius\Ui\View\Components')->not->toUse(['Illuminate\Database', DB::class]);
});

it('keeps source declarations in their PSR-4 location', function (string $class): void {
    expect(class_exists($class) || interface_exists($class) || trait_exists($class))->toBeTrue();
})->with(function (): iterable {
    foreach (new Finder()->files()->in(__DIR__ . '/../../src')->name('*.php') as $file) {
        yield $file->getRelativePathname() => [
            'Sirius\\Ui\\' . str_replace(['/', '\\', '.php'], ['\\', '\\', ''], $file->getRelativePathname()),
        ];
    }
});
