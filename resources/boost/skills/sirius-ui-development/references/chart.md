# Livewire Chart

Use the concrete component inside an application Livewire view:
```blade
<livewire:sirius::chart id="revenue-chart" type="bar"
    :data="$chartData" label="Monthly revenue" :height="320" />
```
Application queries and permissions build chartData; the package never queries models. Props: id=null (generated), type='bar', data=['labels'=>[],'datasets'=>[]], options=[], label=null (translated fallback), description=null, width=null, height=null, loading=false. Native options/data are JSON-serializable; function-string evaluation is forbidden. DOM attributes are not a generic forwarding API.

Bundled Chart.js supports bar, line, scatter, bubble, pie, doughnut, polarArea and radar, mixed datasets and date-fns time axes. Time-axis display uses browser timezone; format timestamps deliberately. No runtime CDN or application Chart.js registration is required.

Reactive parent props update chart data/options; application handles loading, empty/error data, queries and retries. Default data is ['labels' => [], 'datasets' => []]. Explicit height takes precedence over maintainAspectRatio; default stage is 320px. Reduced motion disables animation. label names the canvas; add a description or a separate accessible data representation when needed.

Local JavaScript extensions:
```javascript
window.SiriusChart.register('revenue-chart', ({ element, wire }) => ({
    options: { onClick(event, elements) { /* application-owned callback */ } },
    plugins: [],
}));
```
Check resources/js/chart.js for current extension merge rules and context before using callbacks. SiriusChart.get(id) returns the native chart instance when mounted. Register local functions, not remote strings. Use wire only when the Chart has a Livewire owner. Avoid duplicate Chart initialization; Sirius handles hidden sizing, remounts, updates and cleanup.
