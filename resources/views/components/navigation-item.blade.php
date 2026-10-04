@props(['id' => null, 'icon' => null, 'name' => null, 'link' => null, 'trailing' => null, 'disabled' => false, 'active' => false, 'submenu' => null, 'actionMenu' => false])
@php
    $hasSubmenu = $submenu instanceof \Illuminate\View\ComponentSlot && ! $submenu->isEmpty();
    if (! is_bool($disabled) || ! is_bool($active) || ($name !== null && ! is_string($name))) {
        throw new \InvalidArgumentException('Navigation name must be text and disabled and active must be booleans.');
    }
    if (($name === null || trim($name) === '') && $slot->isEmpty()) {
        throw new \InvalidArgumentException('Navigation items require a name or content.');
    }
    if ($trailing !== null && ! is_string($trailing) && ! $trailing instanceof \Illuminate\View\ComponentSlot) {
        throw new \InvalidArgumentException('Navigation trailing must be text or a named slot.');
    }
    if ($link !== null && (! is_string($link) || preg_match('/[\x00-\x1f\x7f]/', $link) || preg_match('/^\s*(?!https?:|mailto:|tel:)[a-z][a-z0-9+.-]*:/i', $link))) {
        throw new \InvalidArgumentException('Navigation link must be a safe URL.');
    }
    if ($hasSubmenu && $link !== null) {
        throw new \InvalidArgumentException('Submenu triggers cannot also be links.');
    }
    if ($hasSubmenu) {
        $id ??= \Illuminate\Support\Str::random(5);
    }
    if ($id !== null && (! is_string($id) || $id === '' || preg_match('/[\s"\'<>`=]/u', $id))) {
        throw new \InvalidArgumentException('Navigation item ID cannot contain whitespace or markup characters.');
    }
    $as = $link !== null ? 'a' : 'button';
    $itemAttributes = $attributes->except(['id', 'href', 'type', 'role', 'disabled', 'aria-disabled', 'aria-current', 'aria-expanded', 'aria-controls', 'aria-haspopup', 'data-sir-nav-item', 'data-sir-submenu-trigger', 'data-active'])->class(['sir-nav-item']);
    if ($actionMenu || $disabled) {
        $itemAttributes = $itemAttributes->except(['tabindex'])->merge(['tabindex' => '-1']);
    }
@endphp
<li class="sir-nav-entry" @if ($actionMenu) role="none" @endif>
    <{{ $as }} {{ $itemAttributes }} @if ($id !== null) id="{{ $id }}" @endif @if ($as === 'button') type="button" @if ($disabled && ! $actionMenu) disabled @endif @elseif (! $disabled) href="{{ $link }}" @endif @if ($actionMenu) role="menuitem" @elseif ($active && $link !== null) aria-current="page" @endif aria-disabled="{{ $disabled ? 'true' : 'false' }}" data-sir-nav-item data-active="{{ $active ? 'true' : 'false' }}" @if ($hasSubmenu) data-sir-submenu-trigger aria-expanded="false" aria-controls="{{ $id }}-submenu" @if ($actionMenu) aria-haspopup="menu" @endif @endif>
        @if ($icon !== null)<x-sirius-internal-icon :name="$icon" size="sm" />@endif
        <span class="sir-nav-name">@if ($slot->isNotEmpty()){{ $slot }}@else{{ $name }}@endif</span>
        @if ($trailing !== null)<span class="sir-nav-trailing">{{ $trailing }}</span>@endif
        @if ($hasSubmenu)<x-sirius-internal-icon name="heroicon-o-chevron-right" size="sm" class="sir-nav-chevron" />@endif
    </{{ $as }}>
    @if ($hasSubmenu)
        <ul id="{{ $id }}-submenu" class="sir-nav-list sir-nav-submenu" data-sir-nav-list hidden @if ($actionMenu) role="menu" aria-labelledby="{{ $id }}" @endif>{{ $submenu }}</ul>
    @endif
</li>
