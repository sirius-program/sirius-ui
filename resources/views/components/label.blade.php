@props(['for' => null, 'required' => false, 'as' => 'label', 'status' => null, 'statusId' => null])

@php
    if (! in_array($as, ['label', 'legend'], true)) {
        throw new \InvalidArgumentException('Label tag must be label or legend.');
    }

    if ($statusId === null) {
        $statusBaseId = $attributes->get('id');

        if ($statusBaseId === null || $statusBaseId === '') {
            $statusBaseId = $for;
        }

        $statusId = $statusBaseId !== null && $statusBaseId !== '' ? $statusBaseId.'-label-status' : null;
    }
@endphp

@if ($status !== null && $as === 'label')<div class="sir-label-row">@endif
<{{ $as }} @if ($as === 'label' && $for !== null) for="{{ $for }}" @endif {{ $attributes->class(['sir-label']) }}>
    {{ $slot }}@if ($required)<span class="sir-required" aria-hidden="true"> *</span>@endif
    @if ($status !== null && $as === 'legend')<span class="sir-label-status" role="status" data-sir-label-status @if ($statusId) id="{{ $statusId }}" @endif>{{ $status }}</span>@endif
</{{ $as }}>
@if ($status !== null && $as === 'label')
    <span class="sir-label-status" role="status" data-sir-label-status @if ($statusId) id="{{ $statusId }}" @endif>{{ $status }}</span>
</div>
@endif
