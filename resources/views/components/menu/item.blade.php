@props(['id' => null, 'icon' => null, 'name' => null, 'link' => null, 'trailing' => null, 'disabled' => false, 'active' => false, 'submenu' => null, 'open' => false, 'transition' => false])
<x-sirius-internal-navigation-item :$id :$icon :$name :$link :$trailing :$disabled :$active :$submenu :$open :$transition {{ $attributes }}>{{ $slot }}</x-sirius-internal-navigation-item>
