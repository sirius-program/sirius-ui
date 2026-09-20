# Package rules

## Component translations

- Store component UI strings in `resources/lang/{locale}/sirius-ui.php`, grouped by component name, for example `['select' => [...]]`.
- Resolve them through `sirius::sirius-ui.{component}.{key}`. JavaScript widgets receive translated strings from Blade; do not hard-code user-facing widget messages in JavaScript.
- Keep validation rule messages in `resources/lang/{locale}/validation.php` using `sirius::validation.*`.
- Consumers override published translations in `lang/vendor/sirius/{locale}/`. Preserve the existing `sirius-ui-translations` publishing tag.
