@props(['kind', 'id' => null, 'text' => null, 'label' => null, 'trigger' => null, 'variant' => 'info', 'placement' => 'top', 'open' => false, 'panelAttributes' => null])
@php
    $id ??= \Illuminate\Support\Str::random(5);
    if (! is_string($id) || $id === '' || preg_match('/[\s"\'<>`=]/u', $id)) {
        throw new \InvalidArgumentException('Floating components require an ID without whitespace or markup characters.');
    }
    if (! in_array($kind, ['tooltip', 'popover'], true) || ! in_array($variant, ['info', 'primary', 'secondary', 'warning', 'success', 'danger'], true) || ! in_array($placement, ['top', 'right', 'bottom', 'left'], true)) {
        throw new \InvalidArgumentException('Unsupported floating component type, variant, or placement.');
    }
    if (! is_bool($open) || ($panelAttributes !== null && ! $panelAttributes instanceof \Illuminate\View\ComponentAttributeBag)) {
        throw new \InvalidArgumentException('Floating open must be a boolean and panel attributes must be an attribute bag.');
    }
    if (! $trigger instanceof \Illuminate\View\ComponentSlot || $trigger->isEmpty()) {
        throw new \InvalidArgumentException('Provide one focusable element in the trigger slot.');
    }
    if ($kind === 'tooltip' && (! is_string($text) || trim($text) === '')) {
        throw new \InvalidArgumentException('Tooltip text must be non-empty text.');
    }
    if ($kind === 'popover') {
        $label ??= __('sirius::sirius-ui.popover.label');
        if (! is_string($label) || trim($label) === '' || $slot->isEmpty()) {
            throw new \InvalidArgumentException('Popover requires an accessible label and content.');
        }
    }
    $tag = $kind === 'tooltip' ? 'span' : 'div';
    $rootAttributes = $attributes->except(['data-sir-floating', 'data-placement', 'data-initial-open', 'data-open'])->class(['sir-floating']);
    $panelAttributes = ($panelAttributes ?? new \Illuminate\View\ComponentAttributeBag)->class(['sir-floating-panel', 'sir-'.$kind, 'sir-tone--'.$variant]);
@endphp
<{{ $tag }} id="{{ $id }}" {{ $rootAttributes }} data-sir-floating="{{ $kind }}" data-placement="{{ $placement }}" @if ($kind === 'popover') data-initial-open="{{ $open ? 'true' : 'false' }}" @endif>
    <span data-sir-floating-anchor>{{ $trigger }}</span>
    <{{ $tag }} id="{{ $id }}-content" {{ $panelAttributes }} data-sir-floating-panel popover="manual" @if ($kind === 'tooltip') role="tooltip"@else role="dialog" aria-modal="false" aria-label="{{ $label }}" tabindex="-1"@endif>
        <{{ $tag }} class="sir-floating-content">@if ($kind === 'tooltip'){{ $text }}@else{{ $slot }}@endif</{{ $tag }}>
    </{{ $tag }}>
</{{ $tag }}>
