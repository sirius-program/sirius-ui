# Presentation prop inventory

Defaults are declared PHP values. See presentation.md and overlays.md for resolved defaults, slots and events. Use kebab-case attributes in Blade.

## accordion

| Attribute | Declared default |
| --- | --- |
| `id` | `null` |
| `trigger` | `null` |
| `open` | `false` |
| `transition` | `false` |
| `trigger-class` | `''` |
| `content-class` | `''` |

## alert

| Attribute | Declared default |
| --- | --- |
| `id` | `null, 'text'` |
| `title` | `null` |
| `icon` | `null` |
| `variant` | `'info'` |
| `footer` | `null` |
| `open` | `false` |
| `size` | `'md'` |
| `closable` | `false` |
| `close-on-escape` | `true` |
| `close-on-backdrop` | `true` |
| `initial-focus` | `null` |
| `text` | required |

## avatar

| Attribute | Declared default |
| --- | --- |
| `src` | `null` |
| `alt` | `''` |
| `fallback` | `''` |
| `size` | `'md'` |
| `variant` | `'circle'` |

## badge

| Attribute | Declared default |
| --- | --- |
| `variant` | `'info'` |
| `size` | `'md'` |
| `icon` | `null` |

## breadcrumb.item

| Attribute | Declared default |
| --- | --- |
| `link` | `null` |
| `current` | `false` |

## breadcrumb

| Attribute | Declared default |
| --- | --- |
| `label` | `null` |
| `separator` | `'/'` |
| `separator-icon` | `null` |

## button-group

| Attribute | Declared default |
| --- | --- |
| `label` | `null` |

## button

| Attribute | Declared default |
| --- | --- |
| `as` | `'button'` |
| `variant` | `'info'` |
| `size` | `'md'` |
| `icon` | `null` |
| `loading` | `false` |
| `disabled` | `false` |

## card

| Attribute | Declared default |
| --- | --- |
| `id` | `null` |
| `header` | `null` |
| `body` | `null` |
| `footer` | `null` |
| `header-class` | `''` |
| `body-class` | `''` |
| `footer-class` | `''` |

## code

| Attribute | Declared default |
| --- | --- |
| `variant` | `'info'` |
| `block` | `false` |
| `text` | `null` |

## link

| Attribute | Declared default |
| --- | --- |
| `variant` | `'primary'` |

Native `href` and link attributes are forwarded and validated as described in presentation.md.

## dialog

| Attribute | Declared default |
| --- | --- |
| `id` | `null` |
| `header` | `null` |
| `body` | `null` |
| `footer` | `null` |
| `header-class` | `''` |
| `body-class` | `''` |
| `footer-class` | `''` |
| `open` | `false` |
| `size` | `'md'` |
| `closable` | `true` |
| `close-on-escape` | `true` |
| `close-on-backdrop` | `true` |
| `initial-focus` | `null` |

## dropdown.item

| Attribute | Declared default |
| --- | --- |
| `id` | `null` |
| `icon` | `null` |
| `name` | `null` |
| `link` | `null` |
| `trailing` | `null` |
| `disabled` | `false` |
| `active` | `false` |
| `submenu` | `null` |

## dropdown

| Attribute | Declared default |
| --- | --- |
| `id` | `null` |
| `trigger` | `null` |
| `open` | `false` |
| `align` | `'start'` |
| `content-role` | `'menu'` |

## form

| Attribute | Declared default |
| --- | --- |
| `action` | `null` |
| `method` | `'GET'` |
| `sending-file` | `false` |

## icon

| Attribute | Declared default |
| --- | --- |
| `size` | `'md'` |
| `label` | `null` |
| `name` | required |

## menu.item

| Attribute | Declared default |
| --- | --- |
| `id` | `null` |
| `icon` | `null` |
| `name` | `null` |
| `link` | `null` |
| `trailing` | `null` |
| `disabled` | `false` |
| `active` | `false` |
| `submenu` | `null` |

## menu

| Attribute | Declared default |
| --- | --- |
| `label` | `null` |

## message

| Attribute | Declared default |
| --- | --- |
| `id` | `null` |
| `variant` | `'info'` |
| `icon` | `null` |
| `dismissible` | `false` |
| `reset-key` | `''` |

## popover

| Attribute | Declared default |
| --- | --- |
| `id` | `null` |
| `label` | `null` |
| `trigger` | `null` |
| `variant` | `'info'` |
| `placement` | `'bottom'` |
| `open` | `false` |
| `wrapper-class` | `''` |

## separator

| Attribute | Declared default |
| --- | --- |
| `orientation` | `'horizontal'` |
| `decorative` | `false` |

## skeleton

| Attribute | Declared default |
| --- | --- |
| `width` | `'100%'` |
| `height` | `'1rem'` |
| `shape` | `'rounded'` |

## slideover

| Attribute | Declared default |
| --- | --- |
| `id` | `null` |
| `side` | `'right'` |
| `header` | `null` |
| `body` | `null` |
| `footer` | `null` |
| `header-class` | `''` |
| `body-class` | `''` |
| `footer-class` | `''` |
| `open` | `false` |
| `size` | `'md'` |
| `closable` | `true` |
| `close-on-escape` | `true` |
| `close-on-backdrop` | `true` |
| `initial-focus` | `null` |

## tabs

| Attribute | Declared default |
| --- | --- |
| `id` | `null, 'items'` |
| `active` | `null` |
| `label` | `null` |
| `orientation` | `'horizontal'` |
| `activation` | `'automatic'` |
| `list-class` | `''` |
| `panel-class` | `''` |
| `items` | required |

## timeline.item

| Attribute | Declared default |
| --- | --- |
| `description` | `null` |
| `state` | `'upcoming'` |
| `icon` | `null` |
| `number` | `null` |
| `marker` | `null` |
| `title` | required |

## timeline

| Attribute | Declared default |
| --- | --- |
| `label` | `null` |

## toast

| Attribute | Declared default |
| --- | --- |
| `id` | `null, 'text'` |
| `title` | `null` |
| `icon` | `null` |
| `footer` | `null` |
| `variant` | `'info'` |
| `position` | `null` |
| `duration` | `null` |
| `open` | `false` |
| `closable` | `true` |
| `text` | required |

## tooltip

| Attribute | Declared default |
| --- | --- |
| `id` | `null, 'text'` |
| `variant` | `'info'` |
| `placement` | `'top'` |
| `text` | required |
