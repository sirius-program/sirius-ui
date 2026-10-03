@props(['src' => null, 'alt' => '', 'fallback' => '', 'size' => 'md', 'variant' => 'circle'])
@php
    if (($src !== null && ! is_string($src)) || ! is_string($alt) || ! is_string($fallback)) {
        throw new \InvalidArgumentException('Avatar src, alt, and fallback must be strings; src may be null.');
    }
    if (! in_array($size, ['sm', 'md', 'lg', 'xl'], true) || ! in_array($variant, ['rounded', 'circle'], true)) {
        throw new \InvalidArgumentException('Unsupported avatar size or variant.');
    }
    $src = $src !== null && trim($src) !== '' ? $src : null;
    $words = preg_split('/\s+/u', trim($fallback), -1, PREG_SPLIT_NO_EMPTY) ?: [];
    $initials = $words === [] ? '' : \Illuminate\Support\Str::substr($words[0], 0, 1);
    if (count($words) > 1) {
        $initials .= \Illuminate\Support\Str::substr($words[count($words) - 1], 0, 1);
    }
    $initials = \Illuminate\Support\Str::upper($initials);
    $named = $alt !== '' || trim((string) $attributes->get('aria-label', '')) !== '' || trim((string) $attributes->get('aria-labelledby', '')) !== '';
    $avatarAttributes = $attributes->except(['role', 'aria-hidden', 'data-sir-avatar', 'data-image-ready'])->class(['sir-avatar', 'sir-avatar--'.$size, 'sir-avatar--'.$variant]);
    $avatarAttributes = $named
        ? $avatarAttributes->merge(['role' => 'img', ...($alt !== '' ? ['aria-label' => $alt] : [])])
        : $avatarAttributes->merge(['aria-hidden' => 'true']);
@endphp
<span {{ $avatarAttributes }} data-sir-avatar data-image-ready="false">
    <span class="sir-avatar-fallback" data-avatar-fallback aria-hidden="true">
        @if ($initials !== ''){{ $initials }}@else<x-sirius-internal-icon name="heroicon-o-user" />@endif
    </span>
    @if ($src !== null)<img class="sir-avatar-image" data-avatar-image src="{{ $src }}" alt="" aria-hidden="true" />@endif
</span>
