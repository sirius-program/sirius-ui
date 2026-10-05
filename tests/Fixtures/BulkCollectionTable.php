<?php

declare(strict_types=1);

namespace Tests\Fixtures;

final class BulkCollectionTable extends CollectionTable
{
    protected function bulkActionsView(): string
    {
        return 'table-bulk';
    }
}
