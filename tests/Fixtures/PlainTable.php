<?php

declare(strict_types=1);

namespace Tests\Fixtures;

use Sirius\Ui\Table\Filter;

final class PlainTable extends TestTable
{
    protected function rowActionsView(): ?string
    {
        return null;
    }

    /** @return list<Filter> */
    protected function filters(): array
    {
        return [];
    }
}
