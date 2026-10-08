<div id="{{ $tableId }}" class="sir-table" data-sir-table data-selection-count="{{ count($selectedIds) }}" data-external-loading="{{ $loading ? 'true' : 'false' }}" aria-busy="{{ $loading ? 'true' : 'false' }}">
    <div class="sir-table-toolbar">
        @if ($bulkActionsView !== null)
            <x-sirius-internal-dropdown :id="$tableId.'-bulk'" class="sir-table-bulk" data-table-bulk>
                <x-slot:trigger :aria-label="__('sirius::sirius-ui.table.bulk_actions')" :disabled="$selectedIds === [] || $loading"><x-sirius-internal-icon name="heroicon-o-ellipsis-horizontal" /></x-slot:trigger>
                @include($bulkActionsView, ['selectedIds' => $selectedIds])
            </x-sirius-internal-dropdown>
        @endif
        @if ($filterDefinitions !== [])
            <x-sirius-internal-dropdown :id="$tableId.'-filters'" class="sir-table-filters" content-role="dialog" data-sir-dropdown-dismiss="click">
                <x-slot:trigger :aria-label="__('sirius::sirius-ui.table.filters')"><x-sirius-internal-icon name="heroicon-o-funnel" /></x-slot:trigger>
                <div class="sir-table-filter-fields">
                    @foreach ($filterDefinitions as $filter)
                        <div wire:key="{{ $tableId }}-filter-{{ $filter->key }}">
                            @if ($filter->type === 'select')
                                <x-sirius-internal-select :id="$tableId.'-filter-'.$filter->key" :label="$filter->label" :options="$filter->selectOptions()" :search-url="$filter->searchUrl" :value="$filters[$filter->key] ?? null" :placeholder="__('sirius::sirius-ui.table.all')" wire:model.live="filters.{{ $filter->key }}" />
                            @elseif (in_array($filter->type, ['date', 'time', 'datetime'], true))
                                <x-sirius-internal-datetime-picker :id="$tableId.'-filter-'.$filter->key" :label="$filter->label" :type="$filter->type" :value="$filters[$filter->key] ?? null" wire:model.live.change="filters.{{ $filter->key }}" />
                            @else
                                <x-sirius-internal-input type="search" :id="$tableId.'-filter-'.$filter->key" :label="$filter->label" wire:model.live.debounce.300ms="filters.{{ $filter->key }}" />
                            @endif
                        </div>
                    @endforeach
                    <x-sirius-internal-button wire:click="resetFilters">{{ __('sirius::sirius-ui.table.reset_filters') }}</x-sirius-internal-button>
                </div>
            </x-sirius-internal-dropdown>
        @endif
        <x-sirius-internal-input type="search" :id="$tableId.'-search'" :aria-label="__('sirius::sirius-ui.table.search')" :placeholder="__('sirius::sirius-ui.table.search')" wire:model.live.debounce.300ms="search" wrapper-class="sir-table-search" />
    </div>
    <div class="sir-table-results" data-table-region>
        <div data-table-content wire:loading.attr="data-table-request" wire:target.except="toggleSelection,togglePageSelection" @if($loading) inert @endif>
            <div class="sir-table-scroll" tabindex="0" role="region" aria-label="{{ $entityLabel }}">
                <table style="--sir-table-data-columns: {{ count($columns) + ($rowActionsView !== null ? 1 : 0) }}; --sir-table-selection-width: {{ $bulkActionsView !== null ? '3rem' : '0rem' }}">
                    <colgroup>
                        @if ($bulkActionsView !== null)<col class="sir-table-selection-column">@endif
                        @foreach ($columns as $column)<col>@endforeach
                        @if ($rowActionsView !== null)<col>@endif
                    </colgroup>
                    <thead><tr>
                        @if ($bulkActionsView !== null)
                            <th scope="col" class="sir-table-selection"><x-sirius-internal-checkbox :id="$tableId.'-select-page'" :aria-label="__('sirius::sirius-ui.table.select_page')" :checked="$recordKeys !== [] && $pageSelected === count($recordKeys)" :data-table-checked="$recordKeys !== [] && $pageSelected === count($recordKeys) ? 'true' : 'false'" :indeterminate="$pageSelected > 0 && $pageSelected < count($recordKeys)" :disabled="$recordKeys === [] || $loading" wire:click="togglePageSelection" /></th>
                        @endif
                        @foreach ($columns as $column)
                            <th scope="col" @if($column->sortable) aria-sort="{{ ($sortPositions[$column->key] ?? null) === 0 ? ($sorts[$column->key] === 'asc' ? 'ascending' : 'descending') : 'none' }}" @endif>
                                @if ($column->sortable)
                                    <button type="button" wire:click="sortBy('{{ $column->key }}', $event.shiftKey)" title="{{ __('sirius::sirius-ui.table.sort_hint') }}" @if(isset($sortPositions[$column->key])) aria-label="{{ __('sirius::sirius-ui.table.sort_priority', ['column' => $column->label, 'direction' => __('sirius::sirius-ui.table.'.($sorts[$column->key] === 'asc' ? 'ascending' : 'descending')), 'priority' => $sortPositions[$column->key] + 1]) }}" @endif>{{ $column->label }}<span aria-hidden="true">{{ isset($sorts[$column->key]) ? ($sorts[$column->key] === 'asc' ? '↑' : '↓') : '↕' }}@if(count($sorts) > 1 && isset($sortPositions[$column->key]))<sup>{{ $sortPositions[$column->key] + 1 }}</sup>@endif</span></button>
                                @else{{ $column->label }}@endif
                            </th>
                        @endforeach
                        @if($rowActionsView !== null)<th scope="col">{{ __('sirius::sirius-ui.table.actions') }}</th>@endif
                    </tr></thead>
                    <tbody>
                        @forelse ($records as $record)
                            <tr wire:key="{{ $tableId }}-row-{{ $recordKeys[$loop->index] }}" data-table-row="{{ $recordKeys[$loop->index] }}">
                                @if ($bulkActionsView !== null)
                                    <td class="sir-table-selection"><x-sirius-internal-checkbox :id="$tableId.'-select-row-'.$loop->index" :aria-label="__('sirius::sirius-ui.table.select_record', ['id' => $recordKeys[$loop->index]])" :checked="in_array($recordKeys[$loop->index], $selectedIds, true)" :data-table-checked="in_array($recordKeys[$loop->index], $selectedIds, true) ? 'true' : 'false'" :disabled="$loading" wire:click="toggleSelection({{ \Illuminate\Support\Js::from($recordKeys[$loop->index]) }})" /></td>
                                @endif
                                @foreach ($columns as $column)
                                    <td>@if($column->view !== null)@include($column->view, ['record' => $record, 'column' => $column])@else{{ $column->displayValue($record) }}@endif</td>
                                @endforeach
                                @if($rowActionsView !== null)<td><div class="sir-table-actions">@include($rowActionsView, ['record' => $record])</div></td>@endif
                            </tr>
                        @empty
                            <tr><td colspan="{{ count($columns) + ($rowActionsView !== null ? 1 : 0) + ($bulkActionsView !== null ? 1 : 0) }}" class="sir-table-empty">{{ __('sirius::sirius-ui.table.empty', ['label' => $entityLabel]) }}</td></tr>
                        @endforelse
                    </tbody>
                </table>
            </div>
            <div class="sir-table-footer-container">
                <div class="sir-table-footer">
                    <div><p>{{ __('sirius::sirius-ui.table.summary', ['from' => $records->firstItem() ?? 0, 'to' => $records->lastItem() ?? 0, 'shown' => $records->count(), 'total' => $records->total(), 'label' => $entityLabel]) }}</p>@if($bulkActionsView !== null)<p data-table-selected-count role="status">{{ __('sirius::sirius-ui.table.selected_count', ['count' => count($selectedIds)]) }}</p>@endif</div>
                    <div class="sir-table-page-size"><x-sirius-internal-label :for="$tableId.'-per-page'">{{ __('sirius::sirius-ui.table.per_page') }}</x-sirius-internal-label><select id="{{ $tableId }}-per-page" class="sir-control" wire:model.live="perPage">@foreach($pageSizes as $size)<option value="{{ $size }}">{{ $size }}</option>@endforeach</select></div>
                    <nav class="sir-table-pagination" aria-label="{{ __('sirius::sirius-ui.table.pagination') }}">
                        <x-sirius-internal-button size="sm" variant="ghost" :disabled="$records->onFirstPage()" wire:click="goToPage({{ $page - 1 }})">{{ __('sirius::sirius-ui.table.back') }}</x-sirius-internal-button>
                        @foreach($pages as $number)
                            @if($number === null)<span aria-hidden="true">…</span>@else
                                <x-sirius-internal-button size="sm" :variant="$number === $page ? 'primary' : 'ghost'" :aria-current="$number === $page ? 'page' : null" :aria-label="__('sirius::sirius-ui.table.page', ['number' => $number])" wire:click="goToPage({{ $number }})">{{ $number }}</x-sirius-internal-button>
                            @endif
                        @endforeach
                        <x-sirius-internal-button size="sm" variant="ghost" :disabled="!$records->hasMorePages()" wire:click="goToPage({{ $page + 1 }})">{{ __('sirius::sirius-ui.table.next') }}</x-sirius-internal-button>
                    </nav>
                </div>
            </div>
        </div>
        <div class="sir-table-loading" data-table-loading @if(!$loading) hidden @endif role="status" tabindex="-1"><span class="sir-spinner" aria-hidden="true"></span>{{ __('sirius::sirius-ui.table.loading') }}</div>
    </div>
</div>
