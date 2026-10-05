<?php

declare(strict_types=1);

namespace Tests\Fixtures;

final class BulkTable extends TestTable
{
    protected function bulkActionsView(): string
    {
        return 'table-bulk';
    }
}
