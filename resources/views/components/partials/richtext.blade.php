@php
    $config = \Sirius\Ui\Support\RichtextOptions::resolve($toolbar, $height, $options, $uploadUrl, $uploadMaxSize, $uploadAccept);
    $config['language'] = app()->getLocale();
    $config['value'] = (string) ($value ?? $slot);
    $config['resetKey'] = $resetKey;
    $config['messages'] = [];
    foreach (array_merge($config['toolbar'], ['toolbar', 'url', 'apply', 'unlink', 'cancel', 'open_link', 'invalid_url', 'too_long', 'too_short', 'uploading', 'upload_complete', 'upload_error', 'upload_busy', 'invalid_image']) as $key) {
        $config['messages'][$key] = __('sirius::sirius-ui.richtext.'.$key);
    }
    $richtextAttributes = $component->controlAttributes();
    $bindings = $richtextAttributes->filter(fn ($value, $key) => $key === 'wire:model' || str_starts_with($key, 'wire:model.') || $key === 'x-model' || str_starts_with($key, 'x-model.'));
    foreach (array_keys($bindings->getAttributes()) as $binding) {
        if (array_intersect(explode('.', $binding), ['number', 'boolean', 'trim']) !== []) {
            throw new InvalidArgumentException('Richtext bindings must preserve HTML strings.');
        }
    }
@endphp
<div data-sir-richtext data-richtext-config="{{ json_encode($config, JSON_THROW_ON_ERROR) }}">
    <textarea data-richtext-source {{ $richtextAttributes->except(array_keys($bindings->getAttributes())) }}>{{ $value ?? $slot }}</textarea>
    <span hidden data-richtext-model wire:ignore {{ $bindings }}></span>
    <div data-richtext-ui wire:ignore></div>
    <template data-richtext-image-icon>@svg('heroicon-o-photo', 'tiptap-button-icon', ['aria-hidden' => 'true'])</template>
</div>
