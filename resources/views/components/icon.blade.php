@props(['name', 'size' => 'md', 'label' => null])
@php
    if (! is_string($name) || ! preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)+$/', $name)) {
        throw new \InvalidArgumentException('Icon name must be a registered Blade Icons name, such as heroicon-o-check.');
    }
    if (! in_array($size, ['sm', 'md', 'lg'], true)) {
        throw new \InvalidArgumentException('Icon size must be sm, md, or lg.');
    }
    if ($label !== null && (! is_string($label) || trim($label) === '')) {
        throw new \InvalidArgumentException('Icon label must be a non-empty string.');
    }
    $iconAttributes = $attributes->except(['title', 'role', 'aria-hidden', 'aria-label', 'aria-labelledby', 'focusable'])
        ->class(['sir-icon', 'sir-icon--'.$size])->getAttributes();
    $iconAttributes['focusable'] = 'false';
    if ($label === null) {
        $iconAttributes['aria-hidden'] = 'true';
    } else {
        $iconAttributes['role'] = 'img';
        $iconAttributes['aria-label'] = $label;
    }
    $iconAttributes = array_map(fn ($value) => e($value, false), $iconAttributes);
    $accessibility = ' focusable="false"'.($label === null ? ' aria-hidden="true"' : ' role="img" aria-label="'.e($label, false).'"');
    // Blade Icons prepends attributes to the source SVG, which can already declare aria-hidden.
    $iconMarkup = preg_replace_callback('/<svg\b(?:[^>"\']|"[^"]*"|\'[^\']*\')*>/i', function ($match) use ($accessibility) {
        $opening = preg_replace_callback('/\s+([^\s=\/>]+)(?:\s*=\s*(?:"[^"]*"|\'[^\']*\'|[^\s>]+))?/', fn ($attribute) => in_array(strtolower($attribute[1]), ['title', 'role', 'aria-hidden', 'aria-label', 'aria-labelledby', 'focusable'], true) ? '' : $attribute[0], $match[0]);
        return preg_replace('/^<svg\b/i', '<svg'.$accessibility, $opening, 1);
    }, svg($name, '', $iconAttributes)->toHtml(), 1);
@endphp
{{ new \Illuminate\Support\HtmlString($iconMarkup) }}
