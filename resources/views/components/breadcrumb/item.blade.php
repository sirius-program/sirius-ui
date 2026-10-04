@props(['link' => null, 'current' => false])
@aware(['separator' => '/', 'separatorIcon' => null])
@php
    if (! is_bool($current) || ($link !== null && (! is_string($link) || preg_match('/[\x00-\x1f\x7f]/', $link) || preg_match('/^\s*(?!https?:|mailto:|tel:)[a-z][a-z0-9+.-]*:/i', $link)))) {
        throw new \InvalidArgumentException('Breadcrumb current must be a boolean and link must be a safe URL.');
    }
    $itemAttributes = $attributes->except(['aria-current', 'href'])->class(['sir-breadcrumb-link']);
@endphp
<li class="sir-breadcrumb-item">
    <span class="sir-breadcrumb-separator" aria-hidden="true">@if ($separatorIcon !== null)<x-sirius-internal-icon :name="$separatorIcon" size="sm" />@else{{ $separator }}@endif</span>
    @if ($link !== null)
        <a href="{{ $link }}" {{ $itemAttributes }} @if ($current) aria-current="page" @endif>{{ $slot }}</a>
    @else
        <span {{ $itemAttributes }} @if ($current) aria-current="page" @endif>{{ $slot }}</span>
    @endif
</li>
