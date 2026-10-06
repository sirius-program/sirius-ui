import { Calendar } from 'fullcalendar';
import theme from 'fullcalendar/themes/monarch';
import dayGrid from 'fullcalendar/daygrid';
import timeGrid from 'fullcalendar/timegrid';
import list from 'fullcalendar/list';
import interaction from 'fullcalendar/interaction';
import locales from 'fullcalendar/locales-all';

(() => {
    const owner = Symbol.for('sirius.ui.calendar');
    if (window[owner]) return;
    window[owner] = true;
    const states = new Map();
    const extensions = new Map();
    const owned = new Set(['plugins', 'locales', 'theme', 'themeSystem', 'events', 'eventSources', 'initialEvents',
        'eventDataTransform', 'eventSourceSuccess', 'eventSourceFailure', 'eventChange', 'eventAdd', 'eventRemove',
        'eventReceive', 'dateClick', 'select', 'eventClick', 'eventDrop', 'eventResize', 'loading', 'datesSet',
        'resources', 'schedulerLicenseKey']);
    window.SiriusCalendar = {
        get: id => [...states.values()].find(state => state.root.id === id)?.calendar ?? null,
        register(id, factory) {
            if (typeof factory !== 'function') throw new TypeError('Calendar extensions require a local factory.');
            extensions.set(id, factory);
            for (const state of states.values()) if (state.root.id === id) state.extension = null;
            scan();
            return () => { extensions.delete(id); for (const state of states.values()) if (state.root.id === id) state.extension = null; scan(); };
        },
    };
    function status(state, key, retry = false) {
        state.root.querySelector('[data-calendar-status]').textContent = key && !['loading', 'saving'].includes(key) ? state.strings[key] : '';
        state.root.querySelector('[data-calendar-retry]').hidden = !retry;
    }
    function busy(state) {
        const loading = state.fetching || state.mutating || state.interacting;
        if (state.releaseFrame !== null) { cancelAnimationFrame(state.releaseFrame); state.releaseFrame = null; }
        if (!loading && state.busy) {
            state.releaseFrame = requestAnimationFrame(() => {
                state.releaseFrame = null;
                if (state.root.isConnected && !state.fetching && !state.mutating && !state.interacting) applyBusy(state, false);
            });
            return;
        }
        applyBusy(state, loading);
    }
    function applyBusy(state, loading) {
        const overlay = state.root.querySelector('[data-calendar-loading]');
        const feedback = state.root.querySelector('[data-calendar-feedback]');
        if (loading && !state.busy && state.height > 0) state.root.style.setProperty('--sir-calendar-loading-height', state.height + 'px');
        if (!loading) {
            state.root.removeAttribute('data-calendar-height-lock');
            state.root.style.removeProperty('--sir-calendar-loading-height');
        }
        if (loading && !state.busy && (state.ui.contains(document.activeElement) || feedback.contains(document.activeElement))) {
            state.focus = document.activeElement;
        }
        state.root.setAttribute('aria-busy', String(loading));
        state.ui.inert = loading;
        feedback.inert = loading;
        overlay.querySelector('[data-calendar-loading-text]').textContent = state.strings[state.mutating ? 'saving' : 'loading'];
        overlay.hidden = !loading;
        if (!loading && state.busy) {
            requestAnimationFrame(() => {
                if (state.busy || !state.root.isConnected) return;
                const focus = state.focus;
                state.focus = null;
                if (focus?.isConnected && !focus.closest('[inert]') && [document.body, overlay].includes(document.activeElement)) {
                    focus.focus({ preventScroll: true });
                }
            });
        }
        state.busy = loading;
        if (!loading) {
            const height = state.root.getBoundingClientRect().height;
            if (height > 0) state.height = height;
        }
        syncPopovers(state);
    }
    function syncPopovers(state) {
        for (const trigger of state.ui.querySelectorAll('[aria-haspopup="dialog"][aria-controls]')) {
            const popup = document.getElementById(trigger.getAttribute('aria-controls'));
            if (!popup?.matches('[role="dialog"][data-date]')) continue;
            if (!popup.classList.contains('sir-calendar-popover')) popup.classList.add('sir-calendar-popover');
            popup.dataset.calendarOwner = state.root.id;
            popup.inert = state.busy;
            popup.children[1]?.setAttribute('data-calendar-popover-header', '');
            popup.children[2]?.setAttribute('data-calendar-popover-body', '');
        }
    }
    function request(state, method, ...args) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Calendar request timed out.')), 30000);
            state.wire.$call(method, ...args).then(resolve, reject).finally(() => clearTimeout(timeout));
        });
    }
    function span(event) { return { start: event.startStr, end: event.endStr || null, allDay: event.allDay }; }
    function interact(state, action, payload) {
        if (state.busy) return Promise.resolve(false);
        state.interacting = true; busy(state); status(state, 'loading');
        return request(state, 'interact', action, { ...payload, range: range(state) }).catch(() => {
            if (state.root.isConnected) status(state, 'error', true);
            return false;
        }).finally(() => {
            state.interacting = false;
            if (state.root.isConnected) { busy(state); scan(); }
        });
    }
    function range(state) { return { start: state.calendar.view.activeStart.toISOString(), end: state.calendar.view.activeEnd.toISOString() }; }
    async function mutate(state, action, info) {
        if (state.busy) { info.revert(); return; }
        state.mutating = true; busy(state); status(state, 'saving');
        let success = false;
        try {
            success = await request(state, 'interact', action, { eventId: info.event.id, old: span(info.oldEvent), new: span(info.event),
                relatedIds: info.relatedEvents.map(event => event.id), range: range(state) }) === true;
        } catch { success = false; }
        finally {
            state.mutating = false;
            if (!success) info.revert();
            if (state.root.isConnected) {
                if (success) { state.calendar.refetchEvents(); status(state, 'saved'); }
                else { busy(state); status(state, 'rejected', true); }
                scan();
            }
        }
    }
    function initialize(state, restore = null) {
        const options = JSON.parse(state.config);
        const extension = extensions.get(state.root.id);
        const extra = extension?.({ id: state.root.id, element: state.root, wire: state.wire }) ?? {};
        for (const key of Object.keys(extra)) if (owned.has(key)) throw new TypeError('Calendar extension cannot replace adapter-owned option: ' + key);
        for (const view of Object.values(extra.views ?? {})) for (const key of Object.keys(view)) if (owned.has(key)) throw new TypeError('Calendar view extension cannot replace adapter-owned option: ' + key);
        state.extension = extension;
        state.translationConfig = state.root.dataset.calendarStrings;
        state.strings = JSON.parse(state.translationConfig);
        const t = state.strings;
        const buttons = Object.fromEntries(['prev', 'next', 'today', 'dayGridMonth', 'timeGridWeek', 'timeGridDay', 'listWeek'].map(key => [key, { text: t[key], hint: t[key] }]));
        state.calendar = new Calendar(state.ui, {
            ...options, ...extra, ...(restore ? { initialDate: restore.date, initialView: restore.view } : {}),
            plugins: [theme, dayGrid, timeGrid, list, interaction], locales,
            buttons: { ...buttons, ...options.buttons, ...extra.buttons },
            allDayText: options.allDayText ?? t.all_day, noEventsContent: options.noEventsContent ?? t.empty,
            eventDidMount(info) {
                info.el.dataset.calendarEventId = info.event.id;
                if (typeof extra.eventDidMount === 'function') extra.eventDidMount(info);
            },
            events(info, success, failure) {
                const ticket = ++state.ticket;
                state.fetching = true; busy(state); status(state, 'loading');
                request(state, 'fetchEvents', info.start.toISOString(), info.end.toISOString()).then(data => {
                    if (ticket !== state.ticket || !state.root.isConnected) { success([]); return; }
                    success(data); status(state, null);
                }).catch(error => {
                    if (ticket !== state.ticket || !state.root.isConnected) { success([]); return; }
                    failure(error); status(state, 'error', true);
                }).finally(() => {
                    if (ticket === state.ticket && state.root.isConnected) { state.fetching = false; busy(state); }
                });
            },
            dateClick: info => interact(state, 'date-click', { start: info.dateStr, end: null, allDay: info.allDay }),
            select: info => interact(state, 'select', { start: info.startStr, end: info.endStr, allDay: info.allDay }),
            eventClick(info) { info.jsEvent.preventDefault(); interact(state, 'event-click', { eventId: info.event.id, occurrence: span(info.event) }); },
            eventDrop: info => mutate(state, 'event-drop', info), eventResize: info => mutate(state, 'event-resize', info),
        });
        state.calendar.render();
        state.root.dispatchEvent(new CustomEvent('sirius:calendar-ready', { bubbles: true, detail: { id: state.root.id, calendar: state.calendar } }));
    }
    function destroy(state) {
        state.layoutObserver.disconnect();
        if (state.releaseFrame !== null) cancelAnimationFrame(state.releaseFrame);
        if (state.transitionFrame !== null) cancelAnimationFrame(state.transitionFrame);
        state.root.removeAttribute('data-calendar-height-lock');
        state.root.style.removeProperty('--sir-calendar-loading-height');
        state.ticket++; state.cleanup?.forEach(cleanup => cleanup()); state.calendar?.destroy(); states.delete(state.root);
    }
    function scan() {
        for (const state of states.values()) {
            if (!state.root.isConnected) destroy(state);
            else syncPopovers(state);
        }
        if (!window.Livewire) return;
        for (const root of document.querySelectorAll('[data-sir-calendar]')) {
            let state = states.get(root);
            if (!state) {
                const wireId = root.closest('[wire\\:id]')?.getAttribute('wire:id');
                if (!wireId) continue;
                const wire = window.Livewire.find(wireId);
                if (!wire) continue;
                state = { root, wire, ui: root.querySelector('[data-calendar-ui]'), config: root.dataset.calendarConfig,
                    revision: root.dataset.calendarRevision, ticket: 0, fetching: false, mutating: false, interacting: false, busy: false,
                    height: 0, releaseFrame: null, transitionFrame: null };
                state.layoutObserver = new window.ResizeObserver(() => {
                    if (!state.busy && !root.hasAttribute('data-calendar-height-lock')) {
                        const height = root.getBoundingClientRect().height;
                        if (height > 0) state.height = height;
                    }
                });
                state.layoutObserver.observe(root);
                state.cleanup = ['fetchEvents', 'interact'].map(method => wire.$intercept(method, ({ onError }) => {
                    onError(({ preventDefault }) => preventDefault());
                }));
                states.set(root, state); initialize(state);
            } else if (state.mutating || state.interacting) {
                continue;
            } else if (state.config !== root.dataset.calendarConfig || state.translationConfig !== root.dataset.calendarStrings || state.extension !== extensions.get(root.id)) {
                const restore = { view: state.calendar.view.type, date: state.calendar.getDate() };
                const previous = JSON.parse(state.config); const next = JSON.parse(root.dataset.calendarConfig);
                if (previous.initialDate !== next.initialDate) restore.date = next.initialDate;
                if (previous.initialView !== next.initialView) restore.view = next.initialView;
                state.ticket++; state.calendar.destroy(); state.config = root.dataset.calendarConfig; state.revision = root.dataset.calendarRevision;
                initialize(state, restore);
            } else if (state.revision !== root.dataset.calendarRevision) { state.revision = root.dataset.calendarRevision; state.calendar.refetchEvents(); }
        }
    }
    document.addEventListener('click', event => {
        const root = event.target instanceof Element ? event.target.closest('[data-sir-calendar]') : null;
        const state = root ? states.get(root) : null;
        if (state && event.target.closest('[data-calendar-retry]') && !state.busy) state.calendar.refetchEvents();
    });
    for (const type of ['click', 'keydown']) document.addEventListener(type, event => {
        if (!(event.target instanceof Element)) return;
        const popup = event.target.closest('[data-calendar-owner]');
        const root = event.target.closest('[data-sir-calendar]') ?? (popup ? document.getElementById(popup.dataset.calendarOwner) : null);
        if (type === 'click' && root && root.getAttribute('aria-busy') !== 'true' && event.target.closest('.sir-calendar-toolbar button')) {
            const state = states.get(root);
            if (state) {
                state.height = root.getBoundingClientRect().height;
                root.style.setProperty('--sir-calendar-loading-height', state.height + 'px');
                root.setAttribute('data-calendar-height-lock', '');
                if (state.transitionFrame !== null) cancelAnimationFrame(state.transitionFrame);
                state.transitionFrame = requestAnimationFrame(() => {
                    state.transitionFrame = requestAnimationFrame(() => {
                        state.transitionFrame = null;
                        if (!state.busy && root.isConnected) {
                            root.removeAttribute('data-calendar-height-lock');
                            root.style.removeProperty('--sir-calendar-loading-height');
                        }
                    });
                });
            }
        }
        if (root?.getAttribute('aria-busy') === 'true' && (popup || event.target.closest('[data-calendar-ui], [data-calendar-feedback]'))) {
            event.preventDefault();
            event.stopImmediatePropagation();
        }
    }, true);
    document.addEventListener('focusin', event => {
        for (const state of states.values()) {
            if (state.busy && !state.root.contains(event.target)) state.focus = null;
        }
    });
    let queued = false;
    new MutationObserver(() => { if (!queued) { queued = true; queueMicrotask(() => { queued = false; scan(); }); } })
        .observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-calendar-config', 'data-calendar-revision', 'data-calendar-strings'] });
    document.addEventListener('livewire:navigated', scan);
    document.addEventListener('livewire:initialized', scan);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan, { once: true }); else scan();
})();
