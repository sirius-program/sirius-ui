@props([
    'id' => null, 'label' => null, 'name' => null, 'helper' => null,
    'required' => false, 'disabled' => false, 'readonly' => false,
    'errorKey' => null, 'errorBag' => 'default', 'errors' => null,
    'size' => 'md', 'wrapperClass' => '', 'value' => null,
    'toolbar' => null, 'height' => 240, 'options' => [],
    'uploadUrl' => null, 'uploadMaxSize' => 2048, 'uploadAccept' => ['image/jpeg', 'image/png', 'image/webp'],
    'resetKey' => null,
])
<x-sirius-internal-field :id="$id" :label="$label" :name="$name" :helper="$helper"
    :required="$required" :disabled="$disabled" :readonly="$readonly"
    :error-key="$errorKey" :error-bag="$errorBag" :errors="$errors"
    :size="$size" :wrapper-class="$wrapperClass" :attributes="$attributes">
    @include('sirius::components.partials.richtext')
</x-sirius-internal-field>
