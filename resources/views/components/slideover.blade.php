@props(['id' => null, 'side' => 'right', 'header' => null, 'body' => null, 'footer' => null, 'headerClass' => '', 'bodyClass' => '', 'footerClass' => '', 'open' => false, 'size' => 'md', 'closable' => true, 'closeOnEscape' => true, 'closeOnBackdrop' => true, 'initialFocus' => null])
@php
    if (! in_array($side, ['top', 'right', 'bottom', 'left'], true)) {
        throw new \InvalidArgumentException('Slideover side must be top, right, bottom, or left.');
    }
    $slideoverAttributes = $attributes->except(['data-sir-slideover', 'data-side'])->class(['sir-slideover', 'sir-slideover--'.$side]);
@endphp
<x-sirius-internal-dialog :id="$id" :header="$header" :body="$body" :footer="$footer" :header-class="$headerClass" :body-class="$bodyClass" :footer-class="$footerClass" :open="$open" :size="$size" :closable="$closable" :close-on-escape="$closeOnEscape" :close-on-backdrop="$closeOnBackdrop" :initial-focus="$initialFocus" :attributes="$slideoverAttributes" data-sir-slideover data-side="{{ $side }}">{{ $slot }}</x-sirius-internal-dialog>
