@props([
    'id' => null, 'label' => null, 'name' => null, 'helper' => null,
    'required' => false, 'disabled' => false, 'readonly' => false,
    'errorKey' => null, 'errorBag' => 'default', 'errors' => null,
    'size' => 'md', 'wrapperClass' => '', 'multiple' => false,
    'accept' => null, 'maxSize' => null, 'maxFiles' => null,
    'resetKey' => 0, 'options' => [], 'value' => [],
    'preview' => true, 'previewHeight' => 240,
])
@php
    if ($accept !== null && !is_string($accept)) {
        throw new InvalidArgumentException('File upload accept must be a comma-separated string or null.');
    }
    foreach (['maxSize' => $maxSize, 'maxFiles' => $maxFiles] as $key => $limit) {
        if ($limit !== null && (!is_int($limit) || $limit < 1)) {
            throw new InvalidArgumentException('File upload '.$key.' must be a positive integer or null.');
        }
    }
    if (!$multiple && $maxFiles !== null && $maxFiles !== 1) {
        throw new InvalidArgumentException('File upload max-files above one requires multiple mode.');
    }
    $allowedOptions = ['allowDrop', 'allowBrowse', 'allowPaste', 'allowReplace', 'itemInsertLocation'];
    if (!is_array($options) || array_diff(array_keys($options), $allowedOptions) !== []) {
        throw new InvalidArgumentException('Unsupported file upload option. Lifecycle, files, and server options are package-owned.');
    }
    foreach ($options as $key => $option) {
        if ($key === 'itemInsertLocation' ? !in_array($option, ['before', 'after'], true) : !is_bool($option)) {
            throw new InvalidArgumentException('Invalid file upload option '.$key.'.');
        }
    }
    $bindings = $attributes->filter(fn ($value, $key) => $key === 'wire:model' || str_starts_with($key, 'wire:model.'));
    if (count($bindings->getAttributes()) > 1 || $attributes->whereStartsWith('x-model')->isNotEmpty()) {
        throw new InvalidArgumentException('File upload accepts one wire:model and no x-model; browsers cannot prefill local files.');
    }
    $model = array_values($bindings->getAttributes())[0] ?? null;
    if ($model !== null && (!is_string($model) || $model === '')) {
        throw new InvalidArgumentException('File upload wire:model must name a Livewire property.');
    }
    $submittedName = $multiple && $name !== null && !str_ends_with($name, '[]') ? $name.'[]' : $name;
    $existing = \Sirius\Ui\Support\FileUploadValue::normalize($value, (bool) $multiple, $maxFiles);
    if (!is_int($previewHeight) || $previewHeight < 80 || $previewHeight > 1000) {
        throw new InvalidArgumentException('Preview height must be an integer from 80 to 1000 pixels.');
    }
    $messages = [];
    foreach (['idle', 'invalid', 'size', 'max_size', 'type', 'types', 'loading', 'load_error', 'processing', 'complete', 'cancelled', 'process_error', 'revert_error', 'remove_error', 'cancel', 'retry', 'undo', 'remove', 'upload', 'busy', 'open_preview'] as $key) {
        $messages[$key] = __('sirius::sirius-ui.file_upload.'.$key);
    }
    $config = ['multiple' => (bool) $multiple, 'accept' => $accept, 'maxSize' => $maxSize, 'maxFiles' => $multiple ? $maxFiles : 1, 'model' => $model, 'reset' => $resetKey, 'options' => $options, 'messages' => $messages, 'value' => $existing, 'preview' => (bool) $preview, 'previewHeight' => $previewHeight, 'required' => (bool) $required];
@endphp
<x-sirius-internal-field :id="$id" :label="$label" :name="$submittedName" :helper="$helper"
    :required="$required" :disabled="$disabled" :readonly="$readonly" :error-key="$errorKey"
    :error-bag="$errorBag" :errors="$errors" :size="$size" :wrapper-class="$wrapperClass" :attributes="$attributes">
    <div data-sir-file-upload data-upload-config="{{ json_encode($config, JSON_THROW_ON_ERROR) }}">
        <input type="file" data-upload-source {{ $component->controlAttributes()->except([...array_keys($bindings->getAttributes()), 'value']) }}
            @if ($multiple) multiple @endif @if ($accept) accept="{{ $accept }}" @endif>
        <div data-upload-ui wire:ignore></div>
        <p class="sir-error" data-upload-error role="status" hidden></p>
        @if ($slot->isNotEmpty())<div class="sir-helper" data-upload-existing>{{ $slot }}</div>@endif
    </div>
</x-sirius-internal-field>
