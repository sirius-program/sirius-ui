<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Blade;
use Illuminate\View\ViewException;

it('renders a native GET form by default without hidden transport fields', function (): void {
    $html = Blade::render('<x-sirius::form action="/search"><input name="query"></x-sirius::form>');
    expect($html)->toContain('action="/search"', 'method="GET"', '<input name="query">');
    expect($html)->not->toContain('name="_token"', 'name="_method"', 'enctype=', 'sending-file');
});

it('normalizes supported methods and generates exactly the required transport fields', function (string $method, string $native, ?string $spoofed): void {
    $html = Blade::render('<x-sirius::form action="/projects" :method="$method" />', ['method' => $method]);
    expect($html)->toContain('method="' . $native . '"');
    expect(substr_count($html, 'name="_token"'))->toBe($native === 'GET' ? 0 : 1);
    expect(substr_count($html, 'name="_method"'))->toBe($spoofed === null ? 0 : 1);
    if ($spoofed !== null) {
        expect($html)->toContain('value="' . $spoofed . '"');
    }
})->with([
    ['get', 'GET', null], ['pOsT', 'POST', null], ['put', 'POST', 'PUT'],
    ['PaTcH', 'POST', 'PATCH'], ['delete', 'POST', 'DELETE'],
]);

it('forwards escaped attributes and caller classes without leaking props', function (): void {
    $html = Blade::render('<x-sirius::form :action="$action" id="profile" name="profile" class="space-y-4 custom" target="_blank" rel="noopener" autocomplete="off" novalidate accept-charset="UTF-8" data-demo="form" aria-label="Profile" x-data="{}" x-on:submit="ready = true" />', ['action' => '/search?q=" onmouseover="bad']);
    expect($html)->toContain('action="/search?q=&quot; onmouseover=&quot;bad"', 'id="profile"', 'name="profile"', 'class="space-y-4 custom"', 'novalidate', 'accept-charset="UTF-8"', 'target="_blank"', 'rel="noopener"', 'autocomplete="off"', 'data-demo="form"', 'aria-label="Profile"', 'x-data="{}"', 'x-on:submit="ready = true"');
    expect($html)->not->toContain(' onmouseover="');
});

it('supports automatic multipart encoding and preserves explicit encoding when disabled', function (): void {
    foreach (['', ' enctype="multipart/form-data"'] as $extra) {
        $html = Blade::render('<x-sirius::form action="/upload" method="post" sending-file' . $extra . ' />');
        expect(substr_count($html, 'enctype="multipart/form-data"'))->toBe(1);
        expect($html)->not->toContain('sending-file', 'sendingFile');
    }
    $html = Blade::render('<x-sirius::form action="/upload" method="post" :sending-file="false" enctype="text/plain" />');
    expect($html)->toContain('enctype="text/plain"');
    expect(Blade::render('<x-sirius::form action="/search" :sending-file="false" />'))->not->toContain('enctype=');
});

it('rejects ambiguous action method and upload configuration', function (string $template): void {
    expect(fn (): string => Blade::render($template))->toThrow(ViewException::class);
})->with([
    '<x-sirius::form />', '<x-sirius::form action="" />', '<x-sirius::form action="  " />',
    '<x-sirius::form :action="[]" />', '<x-sirius::form action="/" method="HEAD" />',
    '<x-sirius::form action="/" method="OPTIONS" />', '<x-sirius::form action="/" :method="[]" />',
    '<x-sirius::form action="/" sending-file />',
    '<x-sirius::form action="/" method="POST" sending-file enctype="text/plain" />',
    '<x-sirius::form action="/" method="POST" sending-file="false" />',
]);
