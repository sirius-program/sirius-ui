@props(['id' => null, 'header' => null, 'body' => null, 'footer' => null, 'headerClass' => '', 'bodyClass' => '', 'footerClass' => '', 'open' => false, 'size' => 'md', 'closable' => true, 'closeOnEscape' => true, 'closeOnBackdrop' => true, 'initialFocus' => null])
@php
    $id ??= \Illuminate\Support\Str::random(5);
    if (! is_string($id) || $id === '' || preg_match('/[\s"\'<>`=]/u', $id)) {
        throw new \InvalidArgumentException('Dialog requires an ID without whitespace or markup characters.');
    }
    foreach ([$header, $body, $footer] as $section) {
        if ($section !== null && ! is_string($section) && ! $section instanceof \Illuminate\View\ComponentSlot) {
            throw new \InvalidArgumentException('Dialog sections must be strings or Blade slots.');
        }
    }
    foreach ([$open, $closable, $closeOnEscape, $closeOnBackdrop] as $option) {
        if (! is_bool($option)) {
            throw new \InvalidArgumentException('Dialog state and dismissal options must be booleans.');
        }
    }
    if (! in_array($size, ['sm', 'md', 'lg', 'xl', 'full'], true)) {
        throw new \InvalidArgumentException('Unsupported dialog size.');
    }
    if ($initialFocus !== null && (! is_string($initialFocus) || trim($initialFocus) === '')) {
        throw new \InvalidArgumentException('Dialog initial-focus must be a nonempty CSS selector or null.');
    }
    $hasHeader = $header instanceof \Illuminate\View\ComponentSlot ? $header->isNotEmpty() : trim((string) $header) !== '';
    $hasFooter = $footer instanceof \Illuminate\View\ComponentSlot ? $footer->isNotEmpty() : trim((string) $footer) !== '';
    $named = trim((string) $attributes->get('aria-label', '')) !== '' || trim((string) $attributes->get('aria-labelledby', '')) !== '';
    if (! $hasHeader && ! $named) {
        throw new \InvalidArgumentException('Dialog requires a header, aria-label, or aria-labelledby.');
    }
    $dialogAttributes = $attributes->except(['open', 'tabindex', 'role', 'aria-modal', 'closedby', 'data-sir-dialog', 'data-open', 'data-closing', 'data-close-on-escape', 'data-close-on-backdrop', 'data-initial-focus'])->class(['sir-dialog', 'sir-dialog--'.$size]);
    if (! $named) {
        $dialogAttributes = $dialogAttributes->except(['aria-label', 'aria-labelledby'])->merge(['aria-labelledby' => $id.'-header']);
    }
    $headerAttributes = $header instanceof \Illuminate\View\ComponentSlot ? $header->attributes : new \Illuminate\View\ComponentAttributeBag;
    $footerAttributes = $footer instanceof \Illuminate\View\ComponentSlot ? $footer->attributes : new \Illuminate\View\ComponentAttributeBag;
@endphp
<dialog id="{{ $id }}" {{ $dialogAttributes }} data-sir-dialog data-open="{{ $open ? 'true' : 'false' }}" data-close-on-escape="{{ $closeOnEscape ? 'true' : 'false' }}" data-close-on-backdrop="{{ $closeOnBackdrop ? 'true' : 'false' }}" @if ($initialFocus !== null) data-initial-focus="{{ $initialFocus }}" @endif>
    @if ($hasHeader || $closable)
        <div class="sir-dialog-heading">
            @if ($hasHeader)<div id="{{ $id }}-header" {{ $headerAttributes->except('id')->class(['sir-dialog-header', $headerClass]) }}>{{ $header }}</div>@endif
            @if ($closable)
                <button type="button" class="sir-dialog-dismiss" data-sir-dialog-close aria-label="{{ __('sirius::sirius-ui.dialog.close') }}" title="{{ __('sirius::sirius-ui.dialog.close') }}"><x-sirius-internal-icon name="heroicon-o-x-mark" /></button>
            @endif
        </div>
    @endif
    <div id="{{ $id }}-body" class="sir-dialog-body {{ $bodyClass }}">{{ $slot->isNotEmpty() ? $slot : $body }}</div>
    @if ($hasFooter)<div id="{{ $id }}-footer" {{ $footerAttributes->except('id')->class(['sir-dialog-footer', $footerClass]) }}>{{ $footer }}</div>@endif
</dialog>
