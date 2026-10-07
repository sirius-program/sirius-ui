<?php

declare(strict_types=1);

namespace Sirius\Ui\Support;

use Illuminate\Filesystem\Filesystem;
use JsonException;
use RuntimeException;

final readonly class SkillInstaller
{
    public const string NAME = 'sirius-ui-development';

    private const string MANIFEST = '.sirius-ui-skill.json';

    /** @var array<string, string> */
    private const array AGENTS = ['codex' => '.agents/skills', 'claude-code' => '.claude/skills'];

    public function __construct(private Filesystem $files) {}

    /** @return list<string> */
    public function agents(): array
    {
        return array_keys(self::AGENTS);
    }

    public function plan(string $project, string $agent, ?string $source = null): SkillInstallation
    {
        if (!isset(self::AGENTS[$agent])) {
            throw new RuntimeException('Unsupported agent. Choose codex or claude-code.');
        }
        $resolved = realpath($project);
        if ($resolved === false || !is_dir($resolved)) {
            throw new RuntimeException('The consuming project must be an existing directory.');
        }
        $project = str_replace('\\', '/', $resolved);
        $destination = $project . '/' . self::AGENTS[$agent] . '/' . self::NAME;
        $this->checkBoost($project, $agent);
        $this->guard($project, $destination);

        $source ??= dirname(__DIR__, 2) . '/resources/boost/skills/' . self::NAME;
        if (!is_file($source . '/SKILL.md')) {
            throw new RuntimeException('The bundled skill is missing. Reinstall the Sirius UI package.');
        }
        $contents = [];
        $hashes = [];
        foreach ($this->files->allFiles($source) as $file) {
            $relative = str_replace('\\', '/', $file->getRelativePathname());
            $this->relativePath($relative);
            $contents[$relative] = $file->getContents();
            $hashes[$relative] = hash('sha256', $contents[$relative]);
        }
        ksort($contents);
        ksort($hashes);
        $managed = $this->managedFiles($destination);
        $changes = [];
        foreach (array_unique([...array_keys($contents), ...array_keys($managed)]) as $relative) {
            $path = $destination . '/' . $relative;
            $this->guard($project, $path);
            if (file_exists($path) && !is_file($path)) {
                throw new RuntimeException('A skill file path is occupied by a directory: ' . $path);
            }
            $before = is_file($path) ? hash_file('sha256', $path) : null;
            if ($before === false) {
                throw new RuntimeException('Cannot read skill file: ' . $path);
            }
            $content = $contents[$relative] ?? null;
            if ($before !== null && (!isset($managed[$relative]) || $before !== $managed[$relative])) {
                $action = 'conflict';
            } elseif ($content === null) {
                $action = $before === null ? 'unchanged' : 'remove';
            } elseif ($before === ($hashes[$relative] ?? null)) {
                $action = 'unchanged';
            } else {
                $action = $before === null ? 'create' : 'update';
            }
            $changes[$relative] = ['action' => $action, 'before' => $before, 'content' => $content];
        }
        $manifest = json_encode(['owner' => 'sirius/ui', 'schema' => 1, 'bundle' => hash('sha256', json_encode($hashes, JSON_THROW_ON_ERROR)), 'files' => $hashes], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . "\n";

        $manifestPath = $destination . '/' . self::MANIFEST;
        $manifestBefore = is_file($manifestPath) ? hash_file('sha256', $manifestPath) : null;
        if ($manifestBefore === false) {
            throw new RuntimeException('Cannot read the skill ownership manifest.');
        }

        return new SkillInstallation($project, $agent, $destination, $manifest, $manifestBefore, $changes);
    }

    public function apply(SkillInstallation $plan, bool $replaceCustomized = false): void
    {
        if ($plan->hasConflicts() && !$replaceCustomized) {
            throw new RuntimeException('Customized files preserved. Run interactively to review and confirm replacement, or use Boost for Boost-managed skills.');
        }
        $this->checkBoost($plan->project, $plan->agent);
        $this->guard($plan->project, $plan->destination . '/' . self::MANIFEST);
        $manifestPath = $plan->destination . '/' . self::MANIFEST;
        if ((is_file($manifestPath) ? hash_file('sha256', $manifestPath) : null) !== $plan->manifestBefore) {
            throw new RuntimeException('The skill ownership manifest changed after the preview. Run the command again.');
        }
        foreach ($plan->changes as $relative => $change) {
            $this->relativePath($relative);
            $path = $plan->destination . '/' . $relative;
            $this->guard($plan->project, $path);
            $current = is_file($path) ? hash_file('sha256', $path) : null;
            if ($current !== $change['before'] || (file_exists($path) && !is_file($path))) {
                throw new RuntimeException('Skill files changed after the preview. Run the command again.');
            }
        }
        $backup = '.sirius-ui-backups/' . gmdate('Ymd-His') . '-' . bin2hex(random_bytes(4));
        foreach ($plan->changes as $relative => $change) {
            if ($change['action'] === 'unchanged') {
                continue;
            }
            $path = $plan->destination . '/' . $relative;
            if ($change['action'] === 'conflict' && $change['before'] !== null) {
                $backupPath = $plan->destination . '/' . $backup . '/' . $relative;
                $this->guard($plan->project, $backupPath);
                $this->files->ensureDirectoryExists(dirname($backupPath));
                if (!$this->files->copy($path, $backupPath)) {
                    throw new RuntimeException('Cannot back up customized file: ' . $path);
                }
            }
            if ($change['content'] === null) {
                if (!$this->files->delete($path)) {
                    throw new RuntimeException('Cannot remove retired skill file: ' . $path);
                }
            } else {
                $this->files->ensureDirectoryExists(dirname($path));
                if ($this->files->put($path, $change['content']) === false) {
                    throw new RuntimeException('Cannot write skill file: ' . $path);
                }
            }
        }
        $this->files->ensureDirectoryExists($plan->destination);
        $manifestPath = $plan->destination . '/' . self::MANIFEST;
        if (!is_file($manifestPath) || $this->files->get($manifestPath) !== $plan->manifest) {
            if ($this->files->put($manifestPath, $plan->manifest) === false) {
                throw new RuntimeException('Cannot write the skill ownership manifest.');
            }
        }
    }

    /** @return array<string, string> */
    private function managedFiles(string $destination): array
    {
        $path = $destination . '/' . self::MANIFEST;
        $this->guard(dirname($destination, 3), $path);
        if (!is_file($path)) {
            return [];
        }
        $data = $this->readJson($path);
        if (($data['owner'] ?? null) !== 'sirius/ui' || ($data['schema'] ?? null) !== 1 || !is_array($data['files'] ?? null)) {
            throw new RuntimeException('Invalid skill ownership manifest. Restore it from version control before updating.');
        }
        $managed = [];
        foreach ($data['files'] as $relative => $hash) {
            if (!is_string($relative) || !is_string($hash) || !preg_match('/^[a-f0-9]{64}$/D', $hash)) {
                throw new RuntimeException('Invalid skill ownership manifest.');
            }
            $this->relativePath($relative);
            $managed[$relative] = $hash;
        }

        return $managed;
    }

    private function checkBoost(string $project, string $agent): void
    {
        $path = $project . '/boost.json';
        if (!is_file($path)) {
            return;
        }
        $data = $this->readJson($path);
        $agents = $data['agents'] ?? [];
        $skills = $data['skills'] ?? [];
        if (is_array($agents) && is_array($skills) && in_array($agent === 'claude-code' ? 'claude_code' : $agent, $agents, true) && in_array(self::NAME, $skills, true)) {
            throw new RuntimeException('Boost manages this agent skill. Refresh it with php artisan boost:update. Customize the complete bundle in .ai/skills/' . self::NAME . ' instead.');
        }
    }

    /** @return array<string, mixed> */
    private function readJson(string $path): array
    {
        try {
            $data = json_decode($this->files->get($path), true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException $exception) {
            throw new RuntimeException('Invalid JSON in ' . $path, $exception->getCode(), previous: $exception);
        }
        if (!is_array($data)) {
            throw new RuntimeException('Expected a JSON object in ' . $path);
        }

        $object = [];
        foreach ($data as $key => $value) {
            if (!is_string($key)) {
                throw new RuntimeException('Expected a JSON object in ' . $path);
            }
            $object[$key] = $value;
        }

        return $object;
    }

    private function relativePath(string $path): void
    {
        if (!preg_match('~^[a-zA-Z0-9][a-zA-Z0-9._/-]*$~D', $path) || str_contains($path, '//')) {
            throw new RuntimeException('Unsafe skill file path.');
        }
        foreach (explode('/', $path) as $segment) {
            if ($segment === '.' || $segment === '..' || str_ends_with($segment, '.') || preg_match('/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i', $segment)) {
                throw new RuntimeException('Unsafe skill file path.');
            }
        }
    }

    private function guard(string $project, string $path): void
    {
        $prefix = rtrim(str_replace('\\', '/', $project), '/') . '/';
        $path = str_replace('\\', '/', $path);
        if (!str_starts_with($path, $prefix)) {
            throw new RuntimeException('Skill destination must stay inside the consuming project.');
        }
        $cursor = rtrim($prefix, '/');
        foreach (explode('/', substr($path, strlen($prefix))) as $segment) {
            if (in_array($segment, ['..', '.', ''], true)) {
                throw new RuntimeException('Unsafe skill destination.');
            }
            $cursor .= '/' . $segment;
            $real = realpath($cursor);
            if (is_link($cursor) || ($real !== false && strcasecmp(str_replace('\\', '/', $real), $cursor) !== 0)) {
                throw new RuntimeException('Skill destinations cannot contain symlinks or directory junctions: ' . $cursor);
            }
        }
    }
}
