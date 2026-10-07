# Livewire Table

Extend Sirius\Ui\Livewire\Table in app/Livewire. Implement protected query(): Builder|Collection and protected columns(): array. Use Sirius\Ui\Table\Column and Filter value objects. See recipes.md for an executable subclass.

## Query and columns

Scope query() to authorized records BEFORE returning it; package search/sort/filter/pagination build on that source. Eloquent Builder remains database-backed; a Collection holds arrays/objects with a stable integer/string key. Default key is id; override recordKey(array|object $record): int|string if different. pageSizes(): array defaults [10,25,50].

Column constructor: key, label, field=null (defaults key), searchable=false, sortable=false, view=null, format=null. Unique safe keys and query fields are required. format closure receives ($value,$record); return ordinary escaped text. view receives the record/cell context; inspect the installed livewire/table view when requiring extra variables. Never concatenate untrusted HTML into a formatting closure. Header click cycles ascending/descending/none; Shift-click preserves other sort columns.

## Filters

Override protected filters(): array, not filterDefinitions(). Filter constructor: key, label, apply Closure, type='text', options=[], default='', searchUrl=null. Builder callback modifies query; Collection callback MUST return filtered Collection. Types: text (search input), select (Sirius Select), date/time/datetime (Sirius Datetime Picker). Date filter values are canonical; apply application timezone/business boundaries server-side.

Select options is value=>label map; searchUrl provides remote options through the same Select endpoint contract (fields.md). The dropdown stays open for inside interactions and owned popups. Search occupies remaining toolbar width; optional bulk dropdown then filter dropdown precede it. Reset filters is inside filter dropdown. No arbitrary toolbar actions are supported.

## Row and bulk buttons

Override rowActionsView(): ?string and/or bulkActionsView(): ?string to return application Blade views. Row views receive $record; bulk views receive $selectedIds. The table view's $tableId is also available. There is no $recordKey view variable: obtain the application's key from $record. Only bulk-actions-enabled tables render checkboxes. Buttons call application-created Dialog/Alert/Slideover or navigate; Table never executes operations or instantiates those overlays.

Example row view:
```blade
<x-sirius::button data-sir-dialog-open="invoice-review-{{ $tableId }}-{{ data_get($record, 'id') }}">Review</x-sirius::button>
<x-sirius::dialog id="invoice-review-{{ $tableId }}-{{ data_get($record, 'id') }}" header="Review invoice">
    <x-slot:body>{{ data_get($record, 'number') }}</x-slot:body>
</x-sirius::dialog>
```
For shared overlays, dispatch record identity to an application component and re-query/authorize there. Treat selectedIds as request data, re-scope records and authorize every operation. CSV export, transactions and destructive confirmation belong to the application; use an invocable controller for a single export endpoint.

Selection is preserved across pages and cleared by search/filter changes. Header reflects current-page checked/indeterminate state. toggleSelection/togglePageSelection/clearSelection/removeSelection manage selection; selection-only requests do not show the loading overlay.

## Refresh and loading

Use refreshTable() or dispatch('table:refresh.TABLE_ID'). Selection events: table:clear-selection.TABLE_ID and table:remove-selection.TABLE_ID with ids. Use reactive :loading from a parent for external operations. Overlay covers rows/footer and blocks actions, while toolbar/filter/search remain usable; overlays outside table remain interactive.

Mount accepts id and recordLabel; Blade uses record-label to replace translated count/empty nouns, e.g. invoice. Footer displays from/to/total, page size and numbered Previous/Next pagination. All UI strings use sirius::sirius-ui.table.*. Server writes still require validation and authorization even when a loading backdrop blocks clicks.
