<?php

declare(strict_types=1);

namespace Tests\Fixtures;

use Illuminate\Database\Eloquent\Model;

/** @property int $id */
final class TableRecord extends Model
{
    public $timestamps = false;

    protected $guarded = [];

    protected $hidden = ['secret'];
}
