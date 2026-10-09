# Presentation, layout and navigation

Read presentation-props.md for all declared props and defaults. Use colon binding for booleans/arrays. Components accept ordinary attributes unless their documented contract reserves them.

## Visual components

Code renders code with six tones: primary/info/secondary/success/danger/warning, default info. Use block inside your own pre to inherit its formatting without inline padding/tone styling. text supplies escaped source and preserves leading/trailing whitespace; it overrides the slot. The slot accepts authored token markup. Code provides no highlighting or Copy engine.

Link renders an underlined native anchor with the same six tones, default primary, and visible keyboard focus. Pass href and native target/rel/download attributes; class, data/ARIA, Alpine, wire:navigate, and wire:click are forwarded. Static href rejects control characters and non-HTTP(S)/mailto/tel schemes; relative paths/fragments are supported. Dynamic x-bind:href validation is application-owned. Both components inherit surrounding text size and work without JavaScript.

Badge and Message use primary (blue), info (neutral), secondary (indigo), success, danger, warning, ghost and outline. Button also supports link. Button uses as="a" with href for links; defaults to as="button". Provide type="submit" explicitly in forms. loading disables interaction; application authorization remains separate. Icon names reference the installed Blade Icons registry.

Message uses dismissible, reset-key can restore dismissed content after a deliberate state change. Icon and message text align vertically. Default slot is message content. Avatar uses src/alt or fallback, size sm/md/lg/xl and variant circle|rounded. Button Group has a label for the group and contains Buttons; no action engine.

Skeleton uses width/height CSS lengths and shape; Separator uses orientation horizontal|vertical and decorative controls accessible semantics.

## Layout

Card accepts header/body/footer text or named slots; a matching slot overrides text. Default slot supplies body content when body is absent. header-class/body-class/footer-class target each region.

Accordion uses native details/summary. trigger text or a named trigger slot is required; default slot is content. Set the SAME native name on several accordions to create an exclusive group:
```blade
<x-sirius::accordion name="help" trigger="Billing">Billing details</x-sirius::accordion>
<x-sirius::accordion name="help" trigger="Delivery">Delivery details</x-sirius::accordion>
```
open and transition are booleans; trigger-class/content-class style regions.

Tabs items is a name=>label map or name=>{label,icon?,disabled?}. Provide a named panel-{name} slot for EVERY item. Tab names start with a letter, then letters/numbers/hyphens/underscores. active selects an enabled name, otherwise first enabled tab. orientation horizontal|vertical; activation automatic|manual controls keyboard activation. list-class/panel-class style each region. Listen to tabs:change with detail.id/value (verify installed JS event keys before integrating) and update bound state when needed. Native keyboard navigation is built in.
```blade
<x-sirius::tabs id="project-tabs" :items="['overview' => 'Overview', 'members' => 'Members']">
    <x-slot:panel-overview>Project overview</x-slot:panel-overview>
    <x-slot:panel-members>Project members</x-slot:panel-members>
</x-sirius::tabs>
```

Timeline's default slot contains timeline.item children. Item title is required, description optional; default content extends the description. marker is a named slot for arbitrary markup; icon or number provide simpler markers. State upcoming|current|completed.

## Navigation

Breadcrumb contains breadcrumb.item. link creates an anchor; current marks the active location. Set an accessible label or use translation; separator and separator-icon customize separators.

Menu contains menu.item and menu.category. Categories require title and optionally icon; they own the section/list markup. Use a named submenu slot for nested items. Menu.item supports open and transition directly on submenus: open controls initial or bound state, transition animates opening unless reduced motion is enabled; closing hides content immediately. Click, Enter or Space toggles; arrow keys enter or leave nested lists and Escape closes them. Opening a submenu closes its siblings. Disabled items stay closed. Styling is built into sir-menu, with compact triggers and indented content. Item attributes and wire:key apply to the trigger; x-bind:open binds submenu state through Alpine. Do not add manual ul/li wrappers. Dropdown contains dropdown.item. Items support icon, name or default slot, link, trailing text/slot, disabled, active and submenu text/slot. Dropdown requires trigger text or a named trigger slot; align=start|end. content-role defaults menu; use dialog for filter forms. Keep consumer buttons and form controls in dialog content rather than forcing them into menuitem semantics. Dropdown closes for outside interaction; child popup ownership is handled by Sirius.

Popover uses a named trigger slot and default content. wrapper-class applies to wrapper; class applies to content. label is the accessible content name, with a translation fallback. Tooltip wraps a single trigger in its default slot and text provides its message. See overlays.md for placement and lifecycle.
