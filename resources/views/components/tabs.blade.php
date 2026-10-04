@props(['id' => null, 'items', 'active' => null, 'label' => null, 'orientation' => 'horizontal', 'activation' => 'automatic', 'listClass' => '', 'panelClass' => ''])
@php
    $id ??= \Illuminate\Support\Str::random(5);
    $label ??= __('sirius::sirius-ui.tabs.label');
    if (! is_string($id) || $id === '' || preg_match('/[\s"\'<>`=]/u', $id)) {
        throw new \InvalidArgumentException('Tabs requires an ID without whitespace or markup characters.');
    }
    if (! is_array($items) || $items === [] || ($active !== null && ! is_string($active))) {
        throw new \InvalidArgumentException('Tabs requires a non-empty items array and an optional active tab name.');
    }
    if (! is_string($label) || trim($label) === '' || ! in_array($orientation, ['horizontal', 'vertical'], true) || ! in_array($activation, ['automatic', 'manual'], true) || ! is_string($listClass) || ! is_string($panelClass)) {
        throw new \InvalidArgumentException('Unsupported Tabs label, orientation, activation, or class props.');
    }
    $definitions = [];
    $panelNames = [];
    foreach ($items as $name => $item) {
        if (! is_string($name) || ! preg_match('/^[a-zA-Z][a-zA-Z0-9_-]*$/', $name)) {
            throw new \InvalidArgumentException('Tab names must start with a letter and contain only letters, numbers, underscores, or hyphens.');
        }
        $item = is_string($item) ? ['label' => $item] : $item;
        if (! is_array($item) || ! is_string($item['label'] ?? null) || trim($item['label']) === '' || ! is_bool($item['disabled'] ?? false) || (isset($item['icon']) && ! is_string($item['icon']))) {
            throw new \InvalidArgumentException('Each tab requires a text label, an optional icon, and a boolean disabled flag.');
        }
        $panelName = \Illuminate\Support\Str::camel('panel-'.$name);
        if (in_array($panelName, $panelNames, true)) {
            throw new \InvalidArgumentException('Tab names must have distinct Blade slot names.');
        }
        $panelNames[] = $panelName;
        $content = $__laravel_slots[$panelName] ?? null;
        if (! $content instanceof \Illuminate\View\ComponentSlot) {
            throw new \InvalidArgumentException('Provide a panel-'.$name.' named slot for each tab.');
        }
        $definitions[$name] = ['label' => $item['label'], 'disabled' => $item['disabled'] ?? false, 'icon' => $item['icon'] ?? null, 'content' => $content];
    }
    $enabled = array_keys(array_filter($definitions, fn ($item) => ! $item['disabled']));
    $selected = in_array($active, $enabled, true) ? $active : ($enabled[0] ?? null);
@endphp
<div id="{{ $id }}" {{ $attributes->except(['data-sir-tabs', 'data-active', 'data-selected', 'data-orientation', 'data-activation'])->class(['sir-tabs']) }} data-sir-tabs data-active="{{ $active }}" data-selected="{{ $selected }}" data-orientation="{{ $orientation }}" data-activation="{{ $activation }}">
    <div class="sir-tab-list {{ $listClass }}" role="tablist" aria-label="{{ $label }}" aria-orientation="{{ $orientation }}" data-sir-tab-list>
        @foreach ($definitions as $name => $item)
            <button type="button" id="{{ $id }}-tab-{{ $name }}" class="sir-tab" role="tab" data-sir-tab="{{ $name }}" aria-controls="{{ $id }}-panel-{{ $name }}" aria-selected="{{ $selected === $name ? 'true' : 'false' }}" tabindex="{{ $selected === $name ? '0' : '-1' }}" @disabled($item['disabled'])>
                @if ($item['icon'] !== null)<x-sirius-internal-icon :name="$item['icon']" size="sm" />@endif
                <span>{{ $item['label'] }}</span>
            </button>
        @endforeach
    </div>
    <div class="sir-tab-panels">
        @foreach ($definitions as $name => $item)
            <div id="{{ $id }}-panel-{{ $name }}" {{ $item['content']->attributes->except(['id', 'role', 'aria-labelledby', 'data-sir-tab-panel', 'hidden', 'inert', 'tabindex'])->class(['sir-tab-panel', $panelClass]) }} role="tabpanel" aria-labelledby="{{ $id }}-tab-{{ $name }}" data-sir-tab-panel="{{ $name }}" tabindex="0" @if ($selected !== $name) hidden inert @endif>{{ $item['content'] }}</div>
        @endforeach
    </div>
</div>
