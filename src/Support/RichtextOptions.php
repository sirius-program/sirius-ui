<?php

declare(strict_types=1);

namespace Sirius\Ui\Support;

use InvalidArgumentException;

final class RichtextOptions
{
    /**
     * @param  array<array-key, mixed>  $uploadAccept
     * @return array{toolbar: list<string>, height: int, options: array<string, mixed>, upload: array{url: ?string, maxSize: int, accept: list<string>}}
     */
    public static function resolve(mixed $toolbar, mixed $height, mixed $options, ?string $uploadUrl = null, int $uploadMaxSize = 2048, array $uploadAccept = ['image/jpeg', 'image/png', 'image/webp']): array
    {
        $commands = ['bold', 'italic', 'underline', 'strike', 'heading', 'bulletList', 'orderedList', 'blockquote', 'codeBlock', 'link', 'undo', 'redo'];
        $toolbar ??= $commands;
        $commands[] = 'image';
        if (!is_array($toolbar) || !array_is_list($toolbar)) {
            throw new InvalidArgumentException('Richtext toolbar must be a list of supported commands.');
        }
        $buttons = [];
        foreach ($toolbar as $command) {
            if (!is_string($command) || !in_array($command, $commands, true)) {
                throw new InvalidArgumentException('Unsupported richtext toolbar command.');
            }
            $buttons[] = $command;
        }
        if (!is_int($height) || $height < 80 || $height > 2000) {
            throw new InvalidArgumentException('Richtext height must be an integer between 80 and 2000 pixels.');
        }
        if (!is_array($options) || array_diff(array_keys($options), ['headingLevels', 'undoDepth', 'newGroupDelay', 'autolink', 'linkOnPaste']) !== []) {
            throw new InvalidArgumentException('Unsupported richtext options.');
        }
        $options = array_replace(['headingLevels' => [2, 3], 'undoDepth' => 100, 'newGroupDelay' => 500, 'autolink' => true, 'linkOnPaste' => true], $options);
        if (!is_array($options['headingLevels']) || !array_is_list($options['headingLevels']) || $options['headingLevels'] === [] || array_filter($options['headingLevels'], fn ($level): bool => !is_int($level) || $level < 1 || $level > 6) !== []) {
            throw new InvalidArgumentException('Richtext headingLevels must contain integers between 1 and 6.');
        }
        foreach (['undoDepth' => 1000, 'newGroupDelay' => 10000] as $key => $max) {
            if (!is_int($options[$key]) || $options[$key] < 1 || $options[$key] > $max) {
                throw new InvalidArgumentException('Invalid richtext history options.');
            }
        }
        if (!is_bool($options['autolink']) || !is_bool($options['linkOnPaste'])) {
            throw new InvalidArgumentException('Richtext link options must be boolean.');
        }
        if (in_array('image', $buttons, true) && ($uploadUrl === null || trim($uploadUrl) === '')) {
            throw new InvalidArgumentException('Richtext image uploads require an upload-url.');
        }
        if ($uploadMaxSize < 1 || $uploadMaxSize > 102400 || !array_is_list($uploadAccept) || $uploadAccept === []) {
            throw new InvalidArgumentException('Richtext uploads require a positive KiB limit up to 102400 and a list of image MIME types.');
        }
        $mimeTypes = [];
        foreach ($uploadAccept as $mime) {
            if (!is_string($mime) || !in_array($mime, ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'], true)) {
                throw new InvalidArgumentException('Richtext uploads support JPEG, PNG, WebP, GIF, or AVIF only.');
            }
            $mimeTypes[] = $mime;
        }

        return ['toolbar' => array_values(array_unique($buttons)), 'height' => $height, 'options' => [
            'headingLevels' => $options['headingLevels'], 'undoDepth' => $options['undoDepth'],
            'newGroupDelay' => $options['newGroupDelay'], 'autolink' => $options['autolink'], 'linkOnPaste' => $options['linkOnPaste'],
        ], 'upload' => ['url' => $uploadUrl, 'maxSize' => $uploadMaxSize, 'accept' => $mimeTypes]];
    }
}
