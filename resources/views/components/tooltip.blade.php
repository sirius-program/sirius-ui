@props(['id' => null, 'text', 'variant' => 'info', 'placement' => 'top'])
<x-sirius-internal-floating kind="tooltip" :$id :$text :$variant :$placement {{ $attributes }}>
    <x-slot:trigger>{{ $slot }}</x-slot:trigger>
</x-sirius-internal-floating>
