<?php

declare(strict_types=1);

namespace Sirius\Ui\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

final readonly class PhoneNumber implements ValidationRule
{
    /** @param list<string> $callingCodes */
    public function __construct(private array $callingCodes = []) {}

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (!is_string($value) || !preg_match('/^\+[1-9][0-9]{7,14}$/D', $value)) {
            $fail('sirius::validation.phone_number')->translate();

            return;
        }
        if ($this->callingCodes === []) {
            return;
        }
        foreach ($this->callingCodes as $code) {
            if (str_starts_with($value, '+' . $code)) {
                return;
            }
        }
        $fail('sirius::validation.phone_country')->translate();
    }
}
