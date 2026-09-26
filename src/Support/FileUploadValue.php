<?php

declare(strict_types=1);

namespace Sirius\Ui\Support;

use InvalidArgumentException;

final class FileUploadValue
{
    /** @return list<array{name: string, size: int, url: string|null, type: string}> */
    public static function normalize(mixed $value, bool $multiple, ?int $maxFiles): array
    {
        if (!is_array($value) || !array_is_list($value) || (!$multiple && count($value) > 1) || ($maxFiles !== null && count($value) > $maxFiles)) {
            throw new InvalidArgumentException('File upload value must be a list within the configured file count.');
        }
        $types = ['pdf' => 'application/pdf', 'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'gif' => 'image/gif', 'webp' => 'image/webp', 'avif' => 'image/avif', 'bmp' => 'image/bmp'];
        $result = [];
        foreach ($value as $file) {
            if (!is_array($file) || array_diff(array_keys($file), ['name', 'size', 'url']) !== [] || !isset($file['name'], $file['size'])
                || !is_string($file['name']) || $file['name'] === '' || !is_int($file['size']) || $file['size'] < 0 || (isset($file['url']) && !is_string($file['url']))) {
                throw new InvalidArgumentException('Existing files require name and size in bytes; preview url is optional.');
            }
            $type = $types[strtolower(pathinfo($file['name'], PATHINFO_EXTENSION))] ?? null;
            $url = $file['url'] ?? null;
            if ($url !== null && ($type === null || preg_match('/[\x00-\x20\\\\]/', $url) || (!str_starts_with($url, '/') || str_starts_with($url, '//')) && (!filter_var($url, FILTER_VALIDATE_URL) || !in_array(strtolower((string) parse_url($url, PHP_URL_SCHEME)), ['http', 'https'], true)))) {
                throw new InvalidArgumentException('Existing files must be images or PDFs with a root-relative or HTTP(S) preview URL.');
            }
            $result[] = ['name' => $file['name'], 'size' => $file['size'], 'url' => $url, 'type' => $type ?? 'application/octet-stream'];
        }

        return $result;
    }
}
