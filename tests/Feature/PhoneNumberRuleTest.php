<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Lang;
use Illuminate\Support\Facades\Validator;
use Sirius\Ui\Rules\PhoneNumber;

it('validates international phone syntax and optional calling code restrictions', function (mixed $value, PhoneNumber $rule, bool $valid): void {
    $validator = Validator::make(['phone' => $value], ['phone' => ['required', $rule]]);

    expect($validator->passes())->toBe($valid);
})->with([
    'unrestricted international'  => ['+12025550123', new PhoneNumber, true],
    'allowed calling code'        => ['+6281234567890', new PhoneNumber(['62']), true],
    'second allowed calling code' => ['+442079460018', new PhoneNumber(['62', '44']), true],
    'disallowed calling code'     => ['+12025550123', new PhoneNumber(['62', '44']), false],
    'national format'             => ['081234567890', new PhoneNumber, false],
    'display delimiters'          => ['+62 812-3456-7890', new PhoneNumber, false],
    'extension'                   => ['+12025550123 ext 12', new PhoneNumber, false],
    'zero leading code'           => ['+0123456789', new PhoneNumber, false],
    'too short'                   => ['+1234567', new PhoneNumber, false],
    'minimum length'              => ['+12345678', new PhoneNumber, true],
    'maximum length'              => ['+123456789012345', new PhoneNumber, true],
    'too long'                    => ['+1234567890123456', new PhoneNumber, false],
    'trailing newline'            => ["+12025550123\n", new PhoneNumber, false],
    'numeric value'               => [12025550123, new PhoneNumber, false],
    'array value'                 => [['+12025550123'], new PhoneNumber, false],
]);

it('supports optional nullable phone fields and required fields', function (): void {
    expect(Validator::make(['phone' => null], ['phone' => ['nullable', new PhoneNumber]])->passes())->toBeTrue();
    expect(Validator::make(['phone' => null], ['phone' => ['required', new PhoneNumber]])->passes())->toBeFalse();
});

it('uses packaged English messages as translation fallbacks', function (): void {
    app()->setLocale('id');
    app('translator')->setFallback('en');

    $format = Validator::make(['phone' => '0812'], ['phone' => [new PhoneNumber]]);
    $country = Validator::make(['phone' => '+12025550123'], ['phone' => [new PhoneNumber(['62'])]]);

    expect($format->errors()->first('phone'))->toBe('Enter an international phone number without spaces or delimiters.');
    expect($country->errors()->first('phone'))->toBe('Choose a phone number from an allowed country.');
});

it('uses consumer translations and replaces custom attribute placeholders', function (): void {
    app()->setLocale('id');
    Lang::addLines([
        'validation.phone_number'  => ':attribute harus memakai format internasional.',
        'validation.phone_country' => 'Kode negara :attribute tidak diizinkan.',
    ], 'id', 'sirius');

    $format = Validator::make(['phone' => '0812'], ['phone' => [new PhoneNumber]], [], ['phone' => 'Nomor telepon']);
    $country = Validator::make(['phone' => '+12025550123'], ['phone' => [new PhoneNumber(['62'])]], [], ['phone' => 'Nomor telepon']);

    expect($format->errors()->first('phone'))->toBe('Nomor telepon harus memakai format internasional.');
    expect($country->errors()->first('phone'))->toBe('Kode negara Nomor telepon tidak diizinkan.');
});
