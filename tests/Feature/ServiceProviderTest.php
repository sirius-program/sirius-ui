<?php

declare(strict_types=1);

it('merges the default component namespaces', function (): void {
    expect(config('sirius-ui.namespace.blade'))->toBe('sirius')
        ->and(config('sirius-ui.namespace.livewire'))->toBe('sirius');
});
