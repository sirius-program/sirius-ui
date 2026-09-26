<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Blade;
use Illuminate\Support\MessageBag;
use Illuminate\Support\ViewErrorBag;
use Illuminate\View\ViewException;
use Sirius\Ui\Support\FileUploadValue;

it('renders native multipart fields without duplicate Livewire upload handlers', function (): void {
    $html = Blade::render('<x-sirius::file-upload id="docs" name="documents" label="Documents" helper="PDF only" multiple required accept="application/pdf" wire:model="documents" :max-size="2048" :max-files="3" />');
    expect($html)->toContain('name="documents[]"', 'type="file"', 'aria-describedby="docs-helper"', 'for="docs"', 'data-upload-ui', '&quot;model&quot;:&quot;documents&quot;');
    expect($html)->not->toContain('wire:model="documents"');
});

it('rejects invalid upload limits and lifecycle overrides', function (string $attributes): void {
    expect(fn () => Blade::render('<x-sirius::file-upload ' . $attributes . ' />'))->toThrow(ViewException::class);
})->with([':max-size="0"', ':max-files="2"', 'multiple :max-files="-1"', ':options="[\'server\' => \'/upload\']"', ':options="[\'allowDrop\' => \'yes\']"', 'value="/private/file.pdf"', 'x-model="upload"']);

it('escapes application owned existing file content without fetching or deleting it', function (): void {
    $html = Blade::render('<x-sirius::file-upload id="file">{{ $filename }}</x-sirius::file-upload>', ['filename' => '<script>private</script>']);
    expect($html)->toContain('&lt;script&gt;private&lt;/script&gt;', 'data-upload-existing');
    expect($html)->not->toContain('<script>private');
});

it('associates wildcard file validation errors with the upload field', function (): void {
    $errors = (new ViewErrorBag)->put('default', new MessageBag(['files.0' => ['Invalid document.'], 'files.1' => ['Document too large.']]));
    $html = Blade::render('<x-sirius::file-upload id="files" name="files" multiple error-key="files.*" :errors="$errors" />', ['errors' => $errors]);
    expect($html)->toContain('Invalid document.', 'Document too large.', 'aria-describedby="files-error"', 'aria-invalid="true"');
});

it('normalizes existing preview metadata without accepting arbitrary URLs or local paths', function (): void {
    expect(FileUploadValue::normalize([['name' => 'sample.pdf', 'size' => 18810, 'url' => '/sample/sample.pdf']], false, null))
        ->toBe([['name' => 'sample.pdf', 'size' => 18810, 'url' => '/sample/sample.pdf', 'type' => 'application/pdf']]);
});

it('rejects unsafe or malformed existing upload metadata', function (array $value): void {
    expect(fn (): array => FileUploadValue::normalize($value, false, 1))->toThrow(InvalidArgumentException::class);
})->with([
    [[['name' => 'sample.pdf', 'size' => 10, 'url' => 'javascript:alert(1)']]],
    [[['name' => 'sample.pdf', 'size' => -1, 'url' => '/sample.pdf']]],
    [[['name' => 'sample.pdf']]],
    [[['size' => 10]]],
    [[['name' => 'sample.pdf', 'size' => 10, 'url' => '']]],
    [[['name' => 'sample.pdf', 'size' => 10, 'url' => false]]],
    [[['name' => 'sample.txt', 'size' => 10, 'url' => '/sample.txt']]],
    [[['name' => 'sample.pdf', 'size' => 10, 'url' => '//other.test/sample.pdf']]],
    [[['name' => 'sample.pdf', 'size' => 10, 'url' => '/sample.pdf'], ['name' => 'other.pdf', 'size' => 10, 'url' => '/other.pdf']]],
]);

it('accepts metadata without preview URLs for any file type', function (): void {
    $files = FileUploadValue::normalize([
        ['name' => 'sample.pdf', 'size' => 10],
        ['name' => 'sample.jpg', 'size' => 20, 'url' => null],
        ['name' => 'notes.txt', 'size' => 0],
    ], true, 3);
    expect(array_column($files, 'url'))->toBe([null, null, null])
        ->and(array_column($files, 'type'))->toBe(['application/pdf', 'image/jpeg', 'application/octet-stream']);
    $html = Blade::render('<x-sirius::file-upload :value="$files" multiple />', ['files' => [
        ['name' => 'sample.pdf', 'size' => 10], ['name' => 'notes.txt', 'size' => 0],
    ]]);
    expect($html)->toContain('sample.pdf', 'notes.txt', '&quot;url&quot;:null');
});
