<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Blade;
use Illuminate\Support\MessageBag;
use Illuminate\Support\ViewErrorBag;
use Illuminate\View\ViewException;
use Sirius\Ui\SiriusUiServiceProvider;

it('generates a five character control ID and connects its label helper errors and password toggle', function (string $kind): void {
    $errors = (new ViewErrorBag)->put('default', new MessageBag(['sample' => ['Invalid sample']]));
    $html = Blade::render('<x-sirius::' . $kind . ' name="sample" label="Sample" helper="Help" :errors="$errors" ' . ($kind === 'input' ? 'type="password"' : '') . ' />', ['errors' => $errors]);
    preg_match('/<(?:input|textarea)[^>]*\sid="([a-zA-Z0-9]{5})"/', $html, $matches);

    expect($matches)->toHaveCount(2);
    $id = $matches[1] ?? '';
    expect($html)->toContain('for="' . $id . '"', 'id="' . $id . '-helper"', 'id="' . $id . '-error"', 'aria-describedby="' . $id . '-helper ' . $id . '-error"');
    if ($kind === 'input') {
        expect($html)->toContain('data-sir-password-toggle="' . $id . '"', 'aria-controls="' . $id . '"');
    }
})->with(['input', 'textarea', 'checkbox', 'radio', 'switch']);

it('composes native input attributes with the shared field and adornments', function (): void {
    $html = Blade::render('<x-sirius::input id="amount" type="number" name="amount" label="Amount" helper="Units" required readonly min="0" max="100" step="0.5" prefix="$" suffix="kg" value="0" wire:model.blur="amount" />');

    expect($html)->toContain('for="amount"', 'id="amount-helper"', 'aria-describedby="amount-helper"', 'type="number"', 'min="0"', 'max="100"', 'step="0.5"', 'readonly="readonly"', 'required="required"', 'wire:model.blur="amount"', 'value="0"');
    expect(substr_count($html, 'wire:model.blur='))->toBe(1);
    expect($html)->not->toContain('prefix="', 'suffix="');
});

it('uses named slots for adornments and escapes strings and textarea content', function (): void {
    $html = Blade::render('<x-sirius::input id="title" prefix="default"><x-slot:prefix>Slot prefix</x-slot:prefix><x-slot:suffix>Slot suffix</x-slot:suffix></x-sirius::input><x-sirius::textarea id="notes" rows="4" cols="30" maxlength="200" resize="none" :value="$content" />', ['content' => '</textarea><script>bad()</script>']);

    expect($html)->toContain('Slot prefix', 'Slot suffix', 'rows="4"', 'cols="30"', 'maxlength="200"', 'sir-resize-none', '&lt;/textarea&gt;&lt;script&gt;');
    expect($html)->not->toContain('>default<', '<script>');
});

it('renders an accessible non-submit password toggle using Blade Icons', function (): void {
    $html = Blade::render('<x-sirius::input id="secret" type="password" disabled show-label="Reveal secret" hide-label="Hide secret" />');

    expect($html)->toContain('type="password"', 'type="button"', 'aria-controls="secret"', 'aria-label="Reveal secret"', 'title="Reveal secret"', '<svg', 'data-sir-password', 'disabled="disabled"');
});

it('shares errors and native state across all controls', function (string $kind): void {
    $errors = (new ViewErrorBag)->put('account', new MessageBag(['profile.name' => ['Invalid value']]));
    $html = Blade::render('<x-sirius::' . $kind . ' id="control" name="profile[name]" helper="Help" error-bag="account" :errors="$errors" checked readonly required data-test="native" value="0" />', ['errors' => $errors]);

    expect($html)->toContain('Invalid value', 'aria-describedby="control-helper control-error"', 'aria-invalid="true"', 'data-test="native"', 'required="required"');
    if (in_array($kind, ['checkbox', 'radio', 'switch'], true)) {
        expect($html)->toContain('checked', 'data-sir-readonly', 'aria-readonly="true"', 'value="0"');
        expect($html)->not->toContain('readonly="readonly"', 'type="hidden"');
    }
})->with(['input', 'textarea', 'checkbox', 'radio', 'switch']);

it('keeps choice semantics distinct and preserves false states', function (): void {
    $html = Blade::render('<x-sirius::checkbox id="mixed" indeterminate :checked="false" :disabled="false" /><x-sirius::radio id="radio" name="plan" value="0" /><x-sirius::switch id="switch" />');

    expect($html)->toContain('data-sir-indeterminate="true"', 'type="radio"', 'role="switch"');
    expect($html)->not->toContain('checked=', 'disabled=', 'type="switch"');
});

it('renders required markers and errors once per choice group with accessible options', function (string $kind): void {
    $errors = (new ViewErrorBag)->put('account', new MessageBag(['selection' => ['Choose an option.']]));
    $html = Blade::render('<x-sirius::field id="selection" group label="Selection" required helper="Pick an option" error-key="selection" error-bag="account" :errors="$errors"><x-sirius::' . $kind . ' id="first" label="First" name="selection" value="a" aria-describedby="external" helper="First help" /><x-sirius::' . $kind . ' id="second" label="Second" name="selection" value="b" /></x-sirius::field>', ['errors' => $errors]);

    expect(substr_count($html, 'class="sir-required"'))->toBe(1);
    expect(substr_count($html, 'Choose an option.'))->toBe(1);
    expect(substr_count($html, 'required="required"'))->toBe($kind === 'radio' ? 2 : 0);
    expect(substr_count($html, 'aria-invalid="true"'))->toBe(3);
    expect($html)->toContain('aria-describedby="external selection-helper selection-error first-helper"');
    expect($html)->not->toContain('first-error', 'second-error');
})->with(['checkbox', 'radio']);

it('keeps separate groups and standalone choice validation independent', function (): void {
    $errors = (new ViewErrorBag)->put('default', new MessageBag(['outer' => ['Outer error'], 'inner' => ['Inner error'], 'alone' => ['Standalone error']]));
    $html = Blade::render('<x-sirius::field id="outer" group label="Outer" required error-key="outer" :errors="$errors"><x-sirius::checkbox id="outer-option" label="Outer option" required /><x-sirius::field id="inner" group label="Inner" error-key="inner" :errors="$errors"><x-sirius::radio id="inner-option" label="Inner option" /></x-sirius::field></x-sirius::field><x-sirius::checkbox id="alone" label="Alone" name="alone" required :errors="$errors" />', ['errors' => $errors]);

    expect(substr_count($html, 'class="sir-required"'))->toBe(2);
    foreach (['Outer error', 'Inner error', 'Standalone error'] as $message) {
        expect(substr_count($html, $message))->toBe(1);
    }
    expect($html)->toContain('aria-describedby="inner-error"', 'aria-describedby="alone-error"');
    expect($html)->not->toContain('outer-option-error', 'inner-option-error');
});

it('rejects unsupported input types and premature richtext instead of silently changing semantics', function (string $template): void {
    expect(fn () => Blade::render($template))->toThrow(ViewException::class);
})->with([
    '<x-sirius::input id="bad" type="file" />',
    '<x-sirius::textarea id="bad" resize="invalid" />',
    '<x-sirius::textarea id="bad" richtext />',
    '<x-sirius::switch id="bad" indeterminate />',
]);

it('renders controls under a configured namespace', function (): void {
    config(['sirius-ui.blade_namespace' => 'custom']);
    (new SiriusUiServiceProvider(app()))->boot();

    expect(Blade::render('<x-custom::input id="custom" label="Custom" />'))->toContain('for="custom"', 'id="custom"');
});

it('forwards native size separately from visual sizing and preserves textarea slot defaults', function (): void {
    $html = Blade::render('<x-sirius::input id="short" size="sm" control-size="12" autocomplete="off" pattern="[A-Z]+" inputmode="text" /><x-sirius::textarea id="slot">Default notes</x-sirius::textarea>');

    expect($html)->toContain('sir-field--sm', 'size="12"', 'autocomplete="off"', 'pattern="[A-Z]+"', 'inputmode="text"', '>Default notes</textarea>');
});
