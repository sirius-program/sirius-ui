<?php

declare(strict_types=1);

namespace Tests\Fixtures;

use Sirius\Ui\Table\Column;

class MultiSortTable extends TestTable
{
    /** @return list<Column> */
    protected function columns(): array
    {
        return [new Column('name', 'Project', sortable: true), new Column('status', 'Status', sortable: true)];
    }
}
