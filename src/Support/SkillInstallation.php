<?php

declare(strict_types=1);

namespace Sirius\Ui\Support;

final readonly class SkillInstallation
{
    /**
     * @param  array<string, array{action: string, before: ?string, content: ?string}>  $changes
     */
    public function __construct(
        public string $project,
        public string $agent,
        public string $destination,
        public string $manifest,
        public ?string $manifestBefore,
        public array $changes,
    ) {}

    public function hasConflicts(): bool
    {
        foreach ($this->changes as $change) {
            if ($change['action'] === 'conflict') {
                return true;
            }
        }

        return false;
    }
}
