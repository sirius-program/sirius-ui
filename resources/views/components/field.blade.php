@php
    $messages = $messages();
    $description = $describedBy();
@endphp

@if ($group)
    <fieldset id="{{ $id }}" @disabled($disabled)
        @if ($description) aria-describedby="{{ $description }}" @endif
        aria-invalid="{{ $messages !== [] ? 'true' : 'false' }}"
        @class(['sir-field', 'sir-field--group', 'sir-field--'.$size, $wrapperClass])>
        @if ($label !== null && $label !== '')
            <x-sirius-internal-label as="legend" :required="$required && $showRequiredIndicator">{{ $label }}</x-sirius-internal-label>
        @endif
        <div class="sir-field__control">{{ $slot }}</div>
        @include('sirius::components.partials.field-messages')
    </fieldset>
@else
    <div @class(['sir-field', 'sir-field--'.$layout, 'sir-field--'.$size, $wrapperClass])
        @if ($disabled) data-disabled @endif @if ($readonly) data-readonly @endif>
        @if ($layout === 'inline')
            <div class="sir-field__control">{{ $slot }}</div>
        @endif
        @if ($label !== null && $label !== '')
            <x-sirius-internal-label :for="$id" :required="$required && $showRequiredIndicator">{{ $label }}</x-sirius-internal-label>
        @endif
        @if ($layout === 'stacked')
            <div class="sir-field__control">{{ $slot }}</div>
        @endif
        @include('sirius::components.partials.field-messages')
    </div>
@endif
