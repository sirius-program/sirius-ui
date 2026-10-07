# Livewire Calendar

Extend Sirius\Ui\Livewire\Calendar. Implement protected events(CarbonImmutable $start, CarbonImmutable $end, string $timezone): iterable, returning normalized event arrays. Application owns query scoping and all persistence. FullCalendar Standard is bundled locally; Premium resource/timeline/scheduler views are not supported.

## Range and event source

Return events overlapping the half-open visible range: event.start < end AND event.end > start. Include long events starting before the range. Null ends need an application duration/policy. Translate database UTC into the selected timezone; use offset-aware strings for timed records, YYYY-MM-DD for all-day dates. Every id is a unique nonempty string. title is text; do not trust client content/extendedProps.

All-day end is EXCLUSIVE: a one-day October 15 event ends October 16. Simple recurring events use daysOfWeek, startTime, endTime, startRecur, endRecur and groupId; inspect installed normalization before introducing other FullCalendar event fields. No Premium or rrule plugin is assumed.

## Options and hooks

Mount: id, label, initialView, initialDate, locale, timezone, firstDay, selectable, editable, options. Defaults dayGridMonth/today, inherited locale/timezone, selectable=false, editable=false, height=auto. Views dayGridMonth, timeGridWeek, timeGridDay, listWeek. Explicit mount props override options, which override defaults. Reserved event sources, callback strings and unsupported plugin configuration are rejected; inspect Sirius\Ui\Calendar\Options.

Hook methods:
- onDateClick(array $context): void
- onSelect(array $context): void
- onEventClick(array $context): void
- onEventDrop(array $context): bool
- onEventResize(array $context): bool

Default non-mutating hooks dispatch calendar:date-click, calendar:select, calendar:event-click. Mutation hooks return false by default. True acknowledges successful application persistence; false or an error rolls back the client move/resize. Read installed context construction for exact old/new/event fields; do not invent payload names. Server re-fetches source events and verifies identity/range, but consumer hooks must authorize and validate writes.

For event click, context contains id (calendar), timezone, eventId, record (source event) and occurrence (clicked span). Mutation hooks additionally receive old/new spans and relatedIds. Open an application-created overlay using dispatch('dialog:show', id:'schedule-review'); do not ask Calendar to generate a CRUD form. Mutation example in recipes.md.

Recurring drag/resize is disabled unless recurringEditable() returns true. If enabled, distinguish series/server identity from generated occurrence identity and choose an explicit series-versus-occurrence persistence policy. The application owns recurrence exceptions.

## Lifecycle

refreshCalendar() or calendar:refresh.CALENDAR_ID refetches after application actions. configure(array $options) merges supported options and refreshes. Stable IDs distinguish multiple instances. Loading overlay covers the whole calendar and preserves preceding height while the next view fetches; retry/error feedback is translated. Sirius resizes hidden calendars when Tabs/Dialog/Slideover reveal them, cleans listeners on navigation and owns child popups.

Never trust browser event payloads as authorization or write database changes inside the event source solely because it was fetched.
