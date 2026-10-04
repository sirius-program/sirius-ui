@props(['id' => null, 'text', 'title' => null, 'icon' => null, 'footer' => null, 'variant' => 'info', 'position' => null, 'duration' => null, 'open' => false, 'closable' => true])
@php
    $id ??= \Illuminate\Support\Str::random(5);
    if (! is_string($id) || $id === '' || preg_match('/[\s"\'<>`=]/u', $id)) {
        throw new \InvalidArgumentException('Toast requires an ID without whitespace or markup characters.');
    }
    if (! is_string($text) || trim($text) === '') {
        throw new \InvalidArgumentException('Toast text must be a nonempty string.');
    }
    foreach ([$title, $icon] as $optional) {
        if ($optional !== null && (! is_string($optional) || trim($optional) === '')) {
            throw new \InvalidArgumentException('Toast title and icon must be nonempty strings or null.');
        }
    }
    $position ??= config('sirius-ui.toast.position', 'top-end');
    if (! in_array($variant, ['primary', 'info', 'secondary', 'success', 'danger', 'warning', 'ghost', 'outline'], true)
        || ! in_array($position, ['top-start', 'top-center', 'top-end', 'bottom-start', 'bottom-center', 'bottom-end'], true)) {
        throw new \InvalidArgumentException('Unsupported Toast variant or position.');
    }
    $duration ??= config('sirius-ui.toast.duration', 5000);
    if (is_string($duration) && preg_match('/^\d+$/D', $duration)) {
        $duration = filter_var($duration, FILTER_VALIDATE_INT);
    }
    if (! is_int($duration) || $duration < 0 || $duration > 2147483647) {
        throw new \InvalidArgumentException('Toast duration must be an integer from 0 to 2147483647 milliseconds.');
    }
    if (! is_bool($open) || ! is_bool($closable)) {
        throw new \InvalidArgumentException('Toast open and closable must be booleans.');
    }
    if ($footer !== null && ! $footer instanceof \Illuminate\View\ComponentSlot || $slot->isNotEmpty()) {
        throw new \InvalidArgumentException('Toast accepts a named footer slot, not default content or a text footer.');
    }
    $panelAttributes = $attributes->only(['class', 'style', 'aria-label', 'aria-labelledby', 'aria-describedby'])->class(['sir-toast-panel', 'sir-tone--'.$variant]);
    if (! $panelAttributes->has('aria-label') && ! $panelAttributes->has('aria-labelledby')) {
        $panelAttributes = $panelAttributes->merge(['aria-labelledby' => $id.($title !== null ? '-title' : '-text')]);
    }
    $rootAttributes = $attributes->except(['class', 'style', 'aria-label', 'aria-labelledby', 'aria-describedby', 'data-sir-toast', 'data-open', 'data-duration', 'data-position', 'data-variant', 'hidden', 'inert', 'popover', 'role', 'aria-live']);
@endphp
<div id="{{ $id }}" {{ $rootAttributes }} data-sir-toast data-open="{{ $open ? 'true' : 'false' }}" data-duration="{{ $duration }}" data-position="{{ $position }}" data-variant="{{ $variant }}">
    <div id="{{ $id }}-panel" {{ $panelAttributes }} role="group" data-sir-toast-panel popover="manual" inert>
        <div class="sir-toast-content">
            @if ($icon !== null)<x-sirius-internal-icon :name="$icon" class="sir-toast-icon" />@endif
            <div class="sir-toast-copy" data-sir-toast-copy>
                @if ($title !== null)<h2 id="{{ $id }}-title" class="sir-toast-title">{{ $title }}</h2>@endif
                <p id="{{ $id }}-text">{{ $text }}</p>
            </div>
            @if ($closable)<button type="button" class="sir-toast-dismiss" data-sir-toast-close="{{ $id }}" aria-label="{{ __('sirius::sirius-ui.dialog.close') }}" title="{{ __('sirius::sirius-ui.dialog.close') }}"><x-sirius-internal-icon name="heroicon-o-x-mark" /></button>@endif
        </div>
        @if ($footer !== null && $footer->isNotEmpty())<div id="{{ $id }}-footer" {{ $footer->attributes->except('id')->class(['sir-toast-footer']) }}>{{ $footer }}</div>@endif
    </div>
</div>
