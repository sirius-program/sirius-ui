@props(['action' => null, 'method' => 'GET', 'sendingFile' => false])
@php
    if (!is_string($action) || trim($action) === '') {
        throw new InvalidArgumentException('Form requires an explicit, non-empty action URL.');
    }
    if (!is_string($method) || !in_array(strtoupper($method), ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], true)) {
        throw new InvalidArgumentException('Form method must be GET, POST, PUT, PATCH, or DELETE.');
    }
    if (!is_bool($sendingFile)) {
        throw new InvalidArgumentException('Form sending-file must be a boolean.');
    }
    $method = strtoupper($method);
    $enctype = $attributes->get('enctype');
    if ($sendingFile && ($method === 'GET' || ($enctype !== null && (!is_string($enctype) || strtolower(trim($enctype)) !== 'multipart/form-data')))) {
        throw new InvalidArgumentException('Form sending-file requires a non-GET method and multipart/form-data encoding.');
    }
    $formAttributes = $attributes->except(['action', 'method', 'sending-file', 'sendingFile']);
    if ($sendingFile) {
        $formAttributes = $formAttributes->except('enctype')->merge(['enctype' => 'multipart/form-data']);
    }
@endphp
<form action="{{ $action }}" method="{{ $method === 'GET' ? 'GET' : 'POST' }}" {{ $formAttributes }}>
    @if ($method !== 'GET')
        @csrf
    @endif
    @if (!in_array($method, ['GET', 'POST'], true))
        @method($method)
    @endif
    {{ $slot }}
</form>
