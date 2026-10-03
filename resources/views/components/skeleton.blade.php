@props(['width' => '100%', 'height' => '1rem', 'shape' => 'rounded'])
@php
    if (! in_array($shape, ['rectangle', 'rounded', 'circle'], true)) {
        throw new \InvalidArgumentException('Skeleton shape must be rectangle, rounded, or circle.');
    }
    $dimension = static function (mixed $value): string {
        if ((is_int($value) || is_float($value)) && is_finite((float) $value) && $value > 0) {
            return $value.'px';
        }
        if (is_string($value) && preg_match('/^(?:0|(?:\d+(?:\.\d+)?|\.\d+)(?:px|rem|em|%|vw|vh|dvw|dvh|vmin|vmax|ch))$/', $value)) {
            return $value;
        }
        throw new \InvalidArgumentException('Skeleton dimensions must be positive pixel numbers or CSS lengths.');
    };
    $skeletonAttributes = $attributes->except(['role', 'aria-hidden', 'tabindex'])->class(['sir-skeleton', 'sir-skeleton--'.$shape])
        ->style('--sir-skeleton-width: '.$dimension($width).'; --sir-skeleton-height: '.$dimension($height).';')
        ->merge(['role' => 'none', 'aria-hidden' => 'true']);
@endphp
<span {{ $skeletonAttributes }}></span>
