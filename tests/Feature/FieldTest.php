<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Blade;
use Illuminate\Support\MessageBag;
use Illuminate\Support\ViewErrorBag;
use Sirius\Ui\SiriusUiServiceProvider;

it('renders an escaped label with an optional required marker', function (bool $required): void {
    $html = Blade::render('<x-sirius::label for="email" :required="$required">{{ $text }}</x-sirius::label>', [
        'required' => $required,
        'text'     => '<script>unsafe</script>',
    ]);

    expect($html)->toContain('for="email"', '&lt;script&gt;unsafe&lt;/script&gt;');
    expect($html)->not->toContain('<script>');
    expect(str_contains($html, 'aria-hidden="true"'))->toBe($required);
})->with([true, false]);

it('routes native and reactive attributes to the control and composes helper associations', function (): void {
    $html = Blade::render(<<<'BLADE'
        <x-sirius::field id="profile-email" name="email" label="Email" helper="A private address"
            required disabled readonly min="2" max="40" autocomplete="email" data-test="control"
            wire:model.blur="profile.email" aria-describedby="external-note" class="custom-control" wrapper-class="custom-wrapper">
            <input {{ $component->controlAttributes() }}>
        </x-sirius::field>
        BLADE);

    expect($html)->toContain('for="profile-email"', 'id="profile-email-helper"', 'aria-describedby="external-note profile-email-helper"',
        'wire:model.blur="profile.email"', 'class="sir-control custom-control"', 'required="required"', 'disabled="disabled"', 'readonly="readonly"',
        'min="2"', 'max="40"', 'autocomplete="email"', 'data-test="control"', 'custom-wrapper');
    expect(substr_count($html, 'wire:model.blur='))->toBe(1);
    expect($html)->not->toContain('id="profile-email-error"');
});

it('selects explicit keys before model paths and model paths before normalized names', function (?string $key, ?string $model, string $expected): void {
    $errors = (new ViewErrorBag)->put('account', new MessageBag([
        'override'         => ['Explicit message'],
        'profile.email'    => ['Model message'],
        'contacts.0.email' => ['Nested name message'],
    ]));
    $html = Blade::render(<<<'BLADE'
        <x-sirius::field id="email" name="contacts[0][email]" label="Email" helper="Keep this helper"
            :error-key="$key" :errors="$errors" error-bag="account" :wire:model.live="$model">
            <input {{ $component->controlAttributes() }}>
        </x-sirius::field>
        BLADE, ['errors' => $errors, 'key' => $key, 'model' => $model]);

    expect($html)->toContain($expected, 'aria-invalid="true"', 'id="email-error"', 'aria-describedby="email-helper email-error"', 'Keep this helper');
})->with([
    ['override', 'profile.email', 'Explicit message'],
    [null, 'profile.email', 'Model message'],
    [null, null, 'Nested name message'],
]);

it('escapes helper and error strings and does not borrow another named bag', function (): void {
    $errors = (new ViewErrorBag)->put('account', new MessageBag(['email' => ['<img src=x onerror=alert(1)>']]));
    $template = <<<'BLADE'
        <x-sirius::field id="email" name="email" :helper="$helper" :errors="$errors" :error-bag="$bag">
            <input {{ $component->controlAttributes() }}>
        </x-sirius::field>
        BLADE;
    $html = Blade::render($template, ['helper' => '<b>Help</b>', 'errors' => $errors, 'bag' => 'account']);

    expect($html)->toContain('&lt;b&gt;Help&lt;/b&gt;', '&lt;img');
    expect($html)->not->toContain('<img', '<b>Help</b>');
    $html = Blade::render($template, ['helper' => '', 'errors' => $errors, 'bag' => 'default']);
    expect($html)->toContain('aria-invalid="false"');
    expect($html)->not->toContain('email-error', 'email-helper', 'aria-describedby=');
});

it('keeps supplied IDs stable and unique across multiple fields and renders', function (): void {
    $template = <<<'BLADE'
        @foreach (['first', 'second'] as $identity)
            <x-sirius::field :id="$identity" name="email" label="Email" helper="Help">
                <input {{ $component->controlAttributes() }}>
            </x-sirius::field>
        @endforeach
        BLADE;
    $html = Blade::render($template);

    expect(Blade::render($template))->toBe($html);
    foreach (['first', 'second'] as $identity) {
        expect(substr_count($html, 'id="' . $identity . '"'))->toBe(1);
        expect($html)->toContain('for="' . $identity . '"', 'id="' . $identity . '-helper"');
    }
});

it('supports inline labels and accessible choice groups without requiring every option', function (): void {
    $html = Blade::render(<<<'BLADE'
        <x-sirius::field id="agreement" layout="inline" label="I agree" size="sm">
            <input type="checkbox" {{ $component->controlAttributes() }}>
        </x-sirius::field>
        <x-sirius::field id="channels" group label="Channels" helper="Choose one or more" required>
            <input type="checkbox" id="email-option" name="channels[]" value="email">
            <x-sirius::label for="email-option">Email</x-sirius::label>
        </x-sirius::field>
        BLADE);

    expect($html)->toContain('sir-field--inline', 'sir-field--sm', '<fieldset id="channels"', '<legend', 'aria-describedby="channels-helper"');
    expect($html)->not->toContain('required="required"');
});

it('supports configured Blade namespaces for the field and its nested label', function (): void {
    config(['sirius-ui.blade_namespace' => 'custom']);
    (new SiriusUiServiceProvider(app()))->boot();

    expect(Blade::render('<x-custom::field id="custom-email" label="Email"><input {{ $component->controlAttributes() }}></x-custom::field>'))
        ->toContain('for="custom-email"', 'id="custom-email"');
});
