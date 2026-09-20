<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Blade;
use Illuminate\Support\MessageBag;
use Illuminate\Support\ViewErrorBag;
use Illuminate\View\ViewException;
use Sirius\Ui\Support\PhoneCountry;

it('resolves country lists and regional locales without confusing language and country', function (mixed $country, array $countries): void {
    expect(PhoneCountry::resolve($country))->toBe(['countries' => $countries, 'initial' => $countries[0]]);
})->with([
    ['id', ['ID']], ['en', ['US']], ['en-GB', ['GB']], ['id_ID', ['ID']], ['ja', ['JP']],
    [['id', 'ID', 'en-GB'], ['ID', 'GB']], ['ca', ['CA']],
]);

it('honors phone country precedence and uses the global country for a wildcard', function (): void {
    config(['sirius-ui.phone_country' => null, 'sirius-ui.locale' => null, 'app.locale' => null, 'app.fallback_locale' => null]);
    expect(PhoneCountry::resolve()['initial'])->toBe('US');
    config(['app.fallback_locale' => 'id']);
    expect(PhoneCountry::resolve()['initial'])->toBe('ID');
    config(['app.locale' => 'en-GB']);
    expect(PhoneCountry::resolve()['initial'])->toBe('GB');
    config(['sirius-ui.locale' => 'de']);
    expect(PhoneCountry::resolve()['initial'])->toBe('DE');
    config(['sirius-ui.phone_country' => ['ID', 'GB']]);
    expect(PhoneCountry::resolve()['countries'])->toBe(['ID', 'GB']);
    expect(PhoneCountry::resolve('US')['countries'])->toBe(['US']);
    expect(PhoneCountry::resolve('*')['initial'])->toBe('ID');
    config(['sirius-ui.phone_country' => '*']);
    expect(PhoneCountry::resolve()['countries'])->toContain('ID', 'US', 'GB', 'CA');
    expect(PhoneCountry::resolve()['initial'])->toBe('DE');
    config(['sirius-ui.phone_country' => 'unknown']);
    expect(PhoneCountry::resolve('ID')['initial'])->toBe('ID');
});

it('renders one canonical submission field with an accessible shared field and model bridge', function (): void {
    $errors = (new ViewErrorBag)->put('contacts', new MessageBag(['contact.phone' => ['Invalid phone.']]));
    $html = Blade::render('<x-sirius::phone id="contact-phone" name="contact[phone]" country="ID" label="Phone" helper="Mobile" wire:model.live="contact.phone" required readonly :errors="$errors" error-bag="contacts" :control-size="20" maxlength="40" form="contacts" data-test="phone" />', ['errors' => $errors]);
    $dom = new DOMDocument;
    @$dom->loadHTML($html);
    $xpath = new DOMXPath($dom);
    $named = $xpath->query('//*[@name="contact[phone]"]');
    $displays = $xpath->query('//*[@data-sir-phone-display]');
    if ($named === false || $displays === false) {
        throw new RuntimeException('Invalid phone DOM query.');
    }
    expect($named->length)->toBe(1);
    $display = $displays->item(0);
    if (!$display instanceof DOMElement) {
        throw new RuntimeException('Missing phone display.');
    }
    expect($display->getAttribute('type'))->toBe('tel');
    expect($display->getAttribute('aria-describedby'))->toBe('contact-phone-helper contact-phone-error');
    expect($display->getAttribute('aria-invalid'))->toBe('true');
    expect($display->getAttribute('size'))->toBe('20');
    expect($display->hasAttribute('wire:model.live'))->toBeFalse();
    expect($display->hasAttribute('readonly'))->toBeTrue();
    expect($html)->toContain('+62', 'Invalid phone.', 'wire:model.live="contact.phone"', 'data-test="phone"');
    expect($html)->not->toContain('<select');
});

it('renders an ordered selector and escapes restored phone drafts', function (): void {
    $html = Blade::render('<x-sirius::phone name="phone" :country="[\'ID\', \'GB\']" draft-name="phone_draft" :draft="$draft" disabled />', ['draft' => ['country' => 'GB', 'text' => '<script>bad</script>']]);
    expect($html)->toContain('<select', '+62 - Indonesia', '+44 - United Kingdom', 'phone_draft', '&lt;script&gt;', 'disabled');
    expect($html)->not->toContain('<script>');
});

it('rejects unsupported phone configuration', function (string $props): void {
    expect(fn () => Blade::render('<x-sirius::phone ' . $props . ' />'))->toThrow(ViewException::class);
})->with([
    'country="unknown"', ':country="[]"', ':country="[\'ID\', \'*\']"', ':country="12"',
    'delimiter="/"', 'value="081234567890"', ':value="12"',
    'name="phone" draft-name="phone"', ':draft="[\'text\' => \'12\', \'country\' => \'unknown\']"',
    'wire:model.number="phone"', 'x-model.trim="phone"',
]);

it('sorts wildcard countries numerically by calling code while retaining explicit array order', function (): void {
    config(['sirius-ui.phone_country' => null, 'sirius-ui.locale' => null, 'app.locale' => null, 'app.fallback_locale' => null]);
    $resolved = PhoneCountry::resolve('*');
    $metadata = PhoneCountry::countries();
    $codes = array_map(fn (string $country): int => (int) $metadata[$country]['code'], $resolved['countries']);
    $ordered = $codes;
    sort($ordered, SORT_NUMERIC);
    expect($codes)->toBe($ordered);
    expect($resolved['initial'])->toBe('US');
    expect(PhoneCountry::resolve(['ID', 'GB'])['countries'])->toBe(['ID', 'GB']);
});
