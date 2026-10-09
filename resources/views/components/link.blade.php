@props(['variant' => 'primary'])
@php
    if (! in_array($variant, ['primary', 'info', 'secondary', 'success', 'danger', 'warning'], true)) {
        throw new \InvalidArgumentException('Unsupported link variant.');
    }
    $href = $attributes->get('href');
    if ($href !== null && (! is_string($href) || preg_match('/[\x00-\x1f\x7f]/', $href) || preg_match('/^\s*(?!https?:|mailto:|tel:)[a-z][a-z0-9+.-]*:/i', $href))) {
        throw new \InvalidArgumentException('Link href must be a safe URL.');
    }
@endphp
<a {{ $attributes->class(['sir-link', 'sir-tone--'.$variant]) }}>{{ $slot }}</a>
