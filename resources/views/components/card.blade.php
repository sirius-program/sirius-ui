@props(['id' => null, 'header' => null, 'body' => null, 'footer' => null, 'headerClass' => '', 'bodyClass' => '', 'footerClass' => ''])
@php
    foreach ([$header, $body, $footer] as $section) {
        if ($section !== null && ! is_string($section) && ! $section instanceof \Illuminate\View\ComponentSlot) {
            throw new \InvalidArgumentException('Card sections must be strings or Blade slots.');
        }
    }
    $id ??= \Illuminate\Support\Str::random(5);
    if (! is_string($id) || $id === '' || preg_match('/[\s"\'<>`=]/u', $id)) {
        throw new \InvalidArgumentException('Card requires an ID without whitespace or markup characters.');
    }
    $hasHeader = $header instanceof \Illuminate\View\ComponentSlot ? $header->isNotEmpty() : trim((string) $header) !== '';
    $hasFooter = $footer instanceof \Illuminate\View\ComponentSlot ? $footer->isNotEmpty() : trim((string) $footer) !== '';
    $headerAttributes = $header instanceof \Illuminate\View\ComponentSlot ? $header->attributes : new \Illuminate\View\ComponentAttributeBag;
    $footerAttributes = $footer instanceof \Illuminate\View\ComponentSlot ? $footer->attributes : new \Illuminate\View\ComponentAttributeBag;
@endphp
<div id="{{ $id }}" {{ $attributes->class(['sir-card']) }}>
    @if ($hasHeader)
        <div id="{{ $id }}-header" {{ $headerAttributes->except('id')->class(['sir-card-header', $headerClass]) }}>{{ $header }}</div>
    @endif
    <div id="{{ $id }}-body" class="sir-card-body {{ $bodyClass }}">{{ $slot->isNotEmpty() ? $slot : $body }}</div>
    @if ($hasFooter)
        <div id="{{ $id }}-footer" {{ $footerAttributes->except('id')->class(['sir-card-footer', $footerClass]) }}>{{ $footer }}</div>
    @endif
</div>
