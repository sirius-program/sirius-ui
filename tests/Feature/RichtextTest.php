<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Blade;
use Illuminate\Support\MessageBag;
use Illuminate\Support\ViewErrorBag;
use Illuminate\View\ViewException;
use Sirius\Ui\Support\RichtextOptions;

it('renders richtext HTML as escaped textarea content with accessible errors and isolated bindings', function (): void {
    $errors = (new ViewErrorBag)->put('default', new MessageBag(['body' => ['Write a message.']]));
    $html = Blade::render('<x-sirius::richtext id="body" name="body" wire:model.live="body" label="Message" helper="Help" required readonly :errors="$errors" :value="$value" />', ['errors' => $errors, 'value' => '</textarea><script>alert(1)</script>']);
    expect($html)->toContain('data-sir-richtext', 'aria-describedby="body-helper body-error"', 'aria-invalid="true"', 'readonly="readonly"', 'required="required"', '&lt;/textarea&gt;&lt;script&gt;alert(1)&lt;/script&gt;', 'wire:ignore');
    expect(substr_count($html, 'wire:model.live="body"'))->toBe(1);
    expect($html)->not->toContain('<script>');
});

it('keeps native textarea as default and accepts empty and customized richtext toolbars', function (): void {
    expect(Blade::render('<x-sirius::textarea>Notes</x-sirius::textarea>'))->not->toContain('data-sir-richtext');
    $html = Blade::render('<x-sirius::richtext :toolbar="[]" :height="160" :options="[\'headingLevels\' => [3], \'autolink\' => false]" />');
    expect(html_entity_decode($html))->toContain('"toolbar":[]', '"height":160', '"headingLevels":[3]', '"autolink":false');
});

it('uses the application locale and fallback for consumer translations', function (): void {
    app('translator')->addLines(['sirius-ui.richtext.bold' => 'Tebal'], 'id', 'sirius');
    config(['sirius-ui.locale' => 'en']);
    app()->setLocale('id');
    $html = Blade::render('<x-sirius::richtext />');
    expect($html)->toContain('Tebal', 'Italic');
    expect(html_entity_decode($html))->not->toContain('"locale":');
    app()->setLocale('en');
    $html = Blade::render('<x-sirius::richtext />');
    expect($html)->toContain('Bold');
    expect($html)->not->toContain('Tebal');
});

it('rejects unsupported richtext configuration', function (array $toolbar, mixed $height, array $options): void {
    expect(fn (): array => RichtextOptions::resolve($toolbar, $height, $options))->toThrow(InvalidArgumentException::class);
})->with([
    [['image'], 240, []], [['bold'], 20, []], [['bold'], '240px', []],
    [['bold'], 240, ['extensions' => []]], [['bold'], 240, ['headingLevels' => [7]]],
    [['bold'], 240, ['undoDepth' => 0]], [['bold'], 240, ['autolink'        => 'yes']],
]);

it('rejects binding modifiers that corrupt HTML values', function (): void {
    expect(fn () => Blade::render('<x-sirius::richtext wire:model.number="body" />'))->toThrow(ViewException::class);
});

it('enables uploads only with an endpoint and validates image limits and formats', function (): void {
    $config = RichtextOptions::resolve(['image'], 240, [], '/uploads');
    expect($config['upload'])->toBe(['url' => '/uploads', 'maxSize' => 2048, 'accept' => ['image/jpeg', 'image/png', 'image/webp']]);
    expect(fn (): array => RichtextOptions::resolve(['image'], 240, [], '/uploads', 0))->toThrow(InvalidArgumentException::class);
    expect(fn (): array => RichtextOptions::resolve(['image'], 240, [], '/uploads', 2048, ['image/svg+xml']))->toThrow(InvalidArgumentException::class);
    expect(fn (): array => RichtextOptions::resolve(['image'], 240, [], '/uploads', 2048, []))->toThrow(InvalidArgumentException::class);
});
