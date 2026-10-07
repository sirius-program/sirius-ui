---
name: sirius-ui-development
description: "Use Sirius UI in Laravel applications: choose and configure Sirius Blade form controls, layout/navigation components and overlays, or extend its Livewire Table, Calendar and Chart. Activate when implementing, debugging, theming or testing UI built with the installed sirius/ui package."
---

# Sirius UI development

Work against the installed release. Start with composer show sirius/ui and the application's config/sirius-ui.php (if published); inspect config values through Laravel. Never read .env or expose secrets. Inspect existing components and application conventions before changing code.

## Choose the component

| Need | Components |
| --- | --- |
| Plain text or password | Input; Textarea for multiline plain text |
| Formatted values | Currency, Datetime Picker, Phone; Slider for bounded numbers |
| Choices | Select, Checkbox, Radio, Switch |
| Uploads | File Upload |
| Formatted HTML | Richtext, with application sanitization and upload handling |
| Browser form submission | Form; use a native wire:submit form for Livewire |
| Focused or temporary content | Dialog/Alert, Slideover, Toast; Message for inline feedback |
| Content layout | Card, Accordion, Tabs, Timeline, Separator; Skeleton for placeholders |
| Navigation and small visuals | Menu, Dropdown, Breadcrumb, Popover, Tooltip, Button/Group, Badge, Avatar, Icon |
| Data-driven interfaces | Extend Livewire Table/Calendar; mount the concrete Livewire Chart in a parent |

## Choose the reference

- [Setup and boundaries](references/setup.md): namespaces, assets, publishing, translations, themes, testing and troubleshooting.
- [Fields](references/fields.md) and [field props](references/field-props.md): native forms, Livewire bindings, canonical values, validation, uploads and sanitization.
- [Presentation and navigation](references/presentation.md) and [presentation props](references/presentation-props.md): every public Blade component, slots and interactive contracts.
- [Overlays](references/overlays.md): Dialog, Alert, Slideover, Toast, Popover and Tooltip; invocation and close-state synchronization.
- [Table](references/table.md): application subclasses, scoped queries, columns, filters, row and bulk buttons.
- [Calendar](references/calendar.md): scoped schedules, event hooks, acknowledged persistence, recurrence and timezone.
- [Chart](references/chart.md): reactive data, sizing, native Chart.js options and local extensions.
- [Recipes](references/recipes.md): validated form, theme override, scoped Table and Calendar action.

Read only the references needed for the task. Prop inventories contain the shipped defaults; a null default may resolve through configuration or the runtime contract described in the corresponding guide.

## Implementation constraints

Use the configured Blade namespace (default x-sirius::) and Livewire namespace (default sirius). Prefer shipped components and free bundled dependencies. Do not invent props, Table action engines, Calendar CRUD, global toast helpers or CDN requirements. Inspect installed source read-only when a detail is absent; never edit vendor.

Application code owns authorization, tenant scoping, validation, persistence, upload endpoints, HTML sanitization, transactions and exports. Keep CRUD controllers conventional; use an invocable controller for a single action. Client state and selected IDs never authorize a write.

Keep stable IDs and wire:key for interactive instances; let Sirius own widget markup/lifecycle. Do not duplicate Alpine, Tom Select, FilePond, Flatpickr, Tiptap, FullCalendar or Chart.js initialization.

Run the consuming application's relevant feature and browser tests. Check canonical submitted values, server authorization and reset/readonly behavior. Do not claim an agent, browser or framework combination was tested without executing it.
