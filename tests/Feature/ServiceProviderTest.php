<?php

declare(strict_types=1);

it('merges the default component namespaces', function (): void {
    expect(config('sirius-ui.blade_namespace'))->toBe('sirius')
        ->and(config('sirius-ui.livewire_namespace'))->toBe('sirius');
});
