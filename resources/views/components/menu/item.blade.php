@props(['id' => null, 'icon' => null, 'name' => null, 'link' => null, 'trailing' => null, 'disabled' => false, 'active' => false, 'submenu' => null])
<x-sirius-internal-navigation-item :$id :$icon :$name :$link :$trailing :$disabled :$active :$submenu {{ $attributes }}>{{ $slot }}</x-sirius-internal-navigation-item>
