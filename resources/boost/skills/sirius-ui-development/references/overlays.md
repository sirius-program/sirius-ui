# Overlays and notifications

Dialog, Slideover and Alert share the dialog event contract. Render the component FIRST with an explicit stable id. An invocation never creates content from an event payload.

```blade
<x-sirius::button data-sir-dialog-open="project-review">Review</x-sirius::button>
<x-sirius::dialog id="project-review" header="Review project" body="Ready to continue?" />
```

Slideover uses the same data-sir-dialog-open/close triggers; side left|right|top|bottom. Alert requires text, has optional title/icon, variant and footer slot, and shares Dialog invocation. Alert closable defaults false; Dialog/Slideover true. size defaults md. Check presentation-props.md for other defaults.

Application Livewire action:
```php
public function review(): void
{
    $this->dispatch('dialog:show', id: 'project-review');
}
public function closeReview(): void
{
    $this->dispatch('dialog:hide', id: 'project-review');
}
```

DOM invocation uses CustomEvent('dialog:show', {detail:{id:'project-review'}, bubbles:true}). dialog:open/dialog:close bubble from the wrapper. If :open="$reviewing" is bound, synchronize user closure:
```blade
<x-sirius::dialog id="bound-review" :open="$reviewing"
    header="Review" body="Ready?"
    x-on:dialog:close="if ($event.target === $el && $wire.reviewing) $wire.set('reviewing', false)" />
```

Dialog/Slideover have header/body/footer text or named slots and corresponding region classes. The body alone scrolls; header/footer stay visible. Overlays trap focus, restore trigger focus, lock background scrolling without moving sticky content, support Escape/backdrop policy and reduced-motion animations. initial-focus is a selector inside the panel. Place forms in body; keep each form's submit button inside the form or connect via native form attribute from footer.

## Toast

```blade
<x-sirius::toast id="project-saved" title="Saved" text="The project was saved." variant="success">
    <x-slot:footer><x-sirius::button wire:click="undo">Undo</x-sirius::button></x-slot:footer>
</x-sirius::toast>
```
Open/close with data-sir-toast-open/close, or Livewire dispatch('toast:show', id:'project-saved') / toast:hide. DOM events use detail.id. Default slot is NOT supported; use named footer slot for actions. No global dynamic Toast::success helper exists.

Explicit position/duration override sirius-ui.toast.position/duration (top-end / 5000 ms). Duration is milliseconds; zero means persistent. Positions top-start/top-center/top-end/bottom-start/bottom-center/bottom-end follow RTL. Up to 3 visible and 20 queued across positions; overflow closes the oldest queued item. Hover/focus/hidden-page pauses the timer. Footer actions stay interactive above Dialog/Slideover.

toast:open/close bubble with detail.id and detail.reason. Bind :open to Livewire only when needed and synchronize toast:close to false; unrelated morphs should not revive a dismissed notification. For Alpine, bind x-bind:data-open. Navigation/removal cleans queues, timers and references.

## Tooltip and Popover

Both use info as default variant; primary/secondary/success/danger/warning are also supported. placement uses Floating UI placement names (top/bottom/left/right with optional -start/-end). A triangle points at the trigger. Tooltip opens on hover/focus with short exit delay. Popover opens on click with built-in focus and outside/Escape handling; use its named trigger slot.

Prefer these built-in widgets over a second floating/modal library. Verify child Select/Datetime Picker popups inside overlays; do not portal widgets to an unrelated owner manually.
