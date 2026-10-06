<section id="{{ $calendarId }}" class="sir-calendar" data-sir-calendar
    data-calendar-config="{{ json_encode($settings, JSON_THROW_ON_ERROR) }}" data-calendar-revision="{{ $revision }}"
    data-calendar-strings="{{ json_encode(__('sirius::sirius-ui.calendar'), JSON_THROW_ON_ERROR) }}"
    aria-label="{{ $label }}" aria-busy="false">
    <div wire:ignore data-calendar-ui></div>
    <div wire:ignore data-calendar-feedback class="sir-calendar-feedback">
        <p data-calendar-status role="status" aria-live="polite"></p>
        <x-sirius-internal-button data-calendar-retry hidden>{{ __('sirius::sirius-ui.calendar.retry') }}</x-sirius-internal-button>
    </div>
    <div wire:ignore data-calendar-loading class="sir-calendar-loading" hidden role="status" tabindex="-1">
        <span class="sir-spinner" aria-hidden="true"></span>
        <span data-calendar-loading-text>{{ __('sirius::sirius-ui.calendar.loading') }}</span>
    </div>
</section>
