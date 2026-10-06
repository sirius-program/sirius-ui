<section id="{{ $chartId }}" class="sir-chart" data-sir-chart aria-label="{{ $accessibleLabel }}" aria-busy="{{ $loading ? 'true' : 'false' }}"
    data-chart-payload="{{ json_encode($payload, JSON_THROW_ON_ERROR) }}"
    data-chart-strings="{{ json_encode([
        'empty' => __('sirius::sirius-ui.chart.empty'),
        'loading' => __('sirius::sirius-ui.chart.loading'),
        'error' => __('sirius::sirius-ui.chart.error'),
        'retry' => __('sirius::sirius-ui.chart.retry'),
    ], JSON_THROW_ON_ERROR) }}"
    data-chart-loading="{{ $loading ? 'true' : 'false' }}" data-chart-label="{{ $accessibleLabel }}"
    wire:loading.attr="data-chart-request">
    <div wire:ignore data-chart-stage class="sir-chart-stage">
        <canvas data-chart-canvas role="img" aria-label="{{ $accessibleLabel }}">{{ __('sirius::sirius-ui.chart.fallback') }}</canvas>
        <p data-chart-empty class="sir-chart-empty" hidden role="status">{{ __('sirius::sirius-ui.chart.empty') }}</p>
        <div data-chart-loading class="sir-chart-loading" @if(!$loading) hidden @endif role="status">
            <span class="sir-spinner" aria-hidden="true"></span><span data-chart-loading-label>{{ __('sirius::sirius-ui.chart.loading') }}</span>
        </div>
    </div>
    <p id="{{ $chartId }}-description" class="sir-chart-description" @if($description === null || $description === '') hidden @endif>{{ $description }}</p>
    <div wire:ignore class="sir-chart-feedback">
        <p data-chart-status role="status" aria-live="polite"></p>
        <x-sirius-internal-button data-chart-retry hidden>{{ __('sirius::sirius-ui.chart.retry') }}</x-sirius-internal-button>
    </div>
</section>
