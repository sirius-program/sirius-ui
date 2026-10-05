<?php

declare(strict_types=1);

namespace Tests\Fixtures;

use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<TableRecord> */
final class TableRecordFactory extends Factory
{
    protected $model = TableRecord::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return ['name' => 'Website redesign', 'status' => 'pending', 'workspace' => 'design', 'secret' => 'Never serialized'];
    }
}
