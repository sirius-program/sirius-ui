<?php

declare(strict_types=1);

use Illuminate\Filesystem\Filesystem;
use Illuminate\Testing\PendingCommand;
use Sirius\Ui\SiriusUiServiceProvider;
use Sirius\Ui\Support\SkillInstallation;
use Sirius\Ui\Support\SkillInstaller;
use Symfony\Component\Process\Process;
use Symfony\Component\Yaml\Yaml;

use function Pest\Laravel\artisan;

/** @param array<string, mixed> $parameters */
function skillCommand(array $parameters): PendingCommand
{
    $command = artisan('sirius:skills:install', $parameters);
    if (!$command instanceof PendingCommand) {
        throw new RuntimeException('Console output mocking is required for this test.');
    }

    return $command;
}

function skillProject(): string
{
    $path = dirname(__DIR__, 2) . '/.phpunit.cache/skill-consumers/' . bin2hex(random_bytes(8));
    (new Filesystem)->ensureDirectoryExists($path);

    return $path;
}

function skillSource(string $project): string
{
    $source = $project . '/bundle';
    $files = new Filesystem;
    $files->ensureDirectoryExists($source . '/references');
    $files->put($source . '/SKILL.md', "---\nname: sirius-ui-development\ndescription: Develop Sirius UI applications\n---\n[Guide](references/guide.md)\n");
    $files->put($source . '/references/guide.md', 'First release');

    return $source;
}

it('installs the complete bundled skill only in the explicitly selected local agent', function (string $agent, string $folder): void {
    $project = skillProject();
    $files = new Filesystem;
    $files->ensureDirectoryExists($project . '/.agents/skills/unrelated');
    $files->put($project . '/.agents/skills/unrelated/SKILL.md', 'Custom skill');
    $files->put($project . '/AGENTS.md', 'Project instructions');
    $installer = new SkillInstaller($files);
    $plan = $installer->plan($project, $agent);
    $installer->apply($plan);

    expect($files->get($project . '/' . $folder . '/sirius-ui-development/SKILL.md'))->toContain('name: sirius-ui-development');
    foreach ($plan->changes as $relative => $change) {
        expect($files->get($plan->destination . '/' . $relative))->toBe($change['content']);
    }
    expect($files->get($project . '/AGENTS.md'))->toBe('Project instructions');
    expect($files->get($project . '/.agents/skills/unrelated/SKILL.md'))->toBe('Custom skill');
    expect(is_dir($project . ($agent === 'codex' ? '/.claude' : '/.agents/skills/sirius-ui-development')))->toBeFalse();
})->with([['codex', '.agents/skills'], ['claude-code', '.claude/skills']]);

it('keeps repeated installation unchanged and upgrades only managed files', function (): void {
    $project = skillProject();
    $source = skillSource($project);
    $files = new Filesystem;
    $installer = new SkillInstaller($files);
    $first = $installer->plan($project, 'codex', $source);
    $installer->apply($first);
    $files->put($first->destination . '/personal.md', 'Keep this note');
    $repeat = $installer->plan($project, 'codex', $source);
    expect(array_column($repeat->changes, 'action'))->toBe(['unchanged', 'unchanged']);
    $manifest = $files->get($first->destination . '/.sirius-ui-skill.json');
    $installer->apply($repeat);
    expect($files->get($first->destination . '/.sirius-ui-skill.json'))->toBe($manifest);

    $files->put($source . '/SKILL.md', 'Updated entry point');
    $files->delete($source . '/references/guide.md');
    $files->put($source . '/references/new.md', 'New release');
    $installer->apply($installer->plan($project, 'codex', $source));
    expect($files->get($first->destination . '/SKILL.md'))->toBe('Updated entry point');
    expect($files->get($first->destination . '/references/new.md'))->toBe('New release');
    expect(is_file($first->destination . '/references/guide.md'))->toBeFalse();
    expect($files->get($first->destination . '/personal.md'))->toBe('Keep this note');
});

it('preserves customized and colliding files until replacement is explicitly confirmed', function (bool $managed): void {
    $project = skillProject();
    $source = skillSource($project);
    $files = new Filesystem;
    $installer = new SkillInstaller($files);
    $first = $installer->plan($project, 'codex', $source);
    if ($managed) {
        $installer->apply($first);
    } else {
        $files->ensureDirectoryExists($first->destination);
    }
    $files->put($first->destination . '/SKILL.md', 'My customization');
    $plan = $installer->plan($project, 'codex', $source);
    expect($plan->hasConflicts())->toBeTrue();
    expect(fn () => $installer->apply($plan))->toThrow(RuntimeException::class, 'Customized files preserved');
    expect($files->get($first->destination . '/SKILL.md'))->toBe('My customization');
    $installer->apply($plan, replaceCustomized: true);
    expect($files->get($first->destination . '/SKILL.md'))->toContain('name: sirius-ui-development');
    $backups = $files->allFiles($first->destination . '/.sirius-ui-backups');
    expect($backups)->toHaveCount(1);
    expect($backups[0]->getContents())->toBe('My customization');
})->with([true, false]);

it('refuses modified retired files and detects edits made after preview', function (): void {
    $project = skillProject();
    $source = skillSource($project);
    $files = new Filesystem;
    $installer = new SkillInstaller($files);
    $first = $installer->plan($project, 'codex', $source);
    $installer->apply($first);
    $files->put($first->destination . '/references/guide.md', 'Private notes');
    $files->delete($source . '/references/guide.md');
    $plan = $installer->plan($project, 'codex', $source);
    expect(fn () => $installer->apply($plan))->toThrow(RuntimeException::class);
    expect($files->get($first->destination . '/references/guide.md'))->toBe('Private notes');
    $files->put($first->destination . '/SKILL.md', 'Edited after preview');
    expect(fn () => $installer->apply($plan, true))->toThrow(RuntimeException::class, 'changed after the preview');
    expect($files->get($first->destination . '/references/guide.md'))->toBe('Private notes');
});

it('rejects malformed manifests and traversal without touching other project files', function (string $manifest): void {
    $project = skillProject();
    $files = new Filesystem;
    $destination = $project . '/.agents/skills/sirius-ui-development';
    $files->ensureDirectoryExists($destination);
    $files->put($destination . '/.sirius-ui-skill.json', $manifest);
    $files->put($project . '/important.md', 'Keep me');
    expect(fn (): SkillInstallation => (new SkillInstaller($files))->plan($project, 'codex'))->toThrow(RuntimeException::class);
    expect($files->get($project . '/important.md'))->toBe('Keep me');
    expect(is_file($destination . '/SKILL.md'))->toBeFalse();
})->with([
    'invalid JSON'  => '{',
    'wrong owner'   => '{"owner":"other","schema":1,"files":{}}',
    'traversal'     => '{"owner":"sirius/ui","schema":1,"files":{"../../../important.md":"' . str_repeat('0', 64) . '"}}',
    'reserved name' => '{"owner":"sirius/ui","schema":1,"files":{"CON.md":"' . str_repeat('0', 64) . '"}}',
    'invalid hash'  => '{"owner":"sirius/ui","schema":1,"files":{"SKILL.md":"wrong"}}',
]);

it('refuses Boost-owned destinations and unsupported agents', function (): void {
    $project = skillProject();
    $files = new Filesystem;
    $files->put($project . '/boost.json', '{"agents":["codex","claude_code"],"skills":["sirius-ui-development"]}');
    $installer = new SkillInstaller($files);
    foreach (['codex', 'claude-code'] as $agent) {
        expect(fn (): SkillInstallation => $installer->plan($project, $agent))->toThrow(RuntimeException::class, 'boost:update');
    }
    expect(fn (): SkillInstallation => $installer->plan($project, 'unknown'))->toThrow(RuntimeException::class, 'Unsupported agent');
    expect(is_dir($project . '/.agents'))->toBeFalse();
    expect(is_dir($project . '/.claude'))->toBeFalse();
});

it('rejects linked destination ancestors before writing through them', function (): void {
    $project = skillProject();
    $outside = skillProject();
    $link = $project . '/.agents';
    if (PHP_OS_FAMILY === 'Windows') {
        $process = new Process(['cmd', '/c', 'mklink', '/J', str_replace('/', '\\', $link), str_replace('/', '\\', $outside)]);
        $process->mustRun();
    } else {
        symlink($outside, $link);
    }
    expect(fn (): SkillInstallation => (new SkillInstaller(new Filesystem))->plan($project, 'codex'))->toThrow(RuntimeException::class, 'junctions');
    expect(is_dir($outside . '/skills'))->toBeFalse();
    file_put_contents($project . '/boost.json', '{"agents":["codex"],"skills":["sirius-ui-development"]}');
    expect(fn (): SkillInstallation => (new SkillInstaller(new Filesystem))->plan($project, 'codex'))->toThrow(RuntimeException::class, 'boost:update');
});

it('previews command paths without installing and preserves conflicts in noninteractive execution', function (): void {
    $project = skillProject();
    $original = app()->basePath();
    app()->setBasePath($project);
    try {
        skillCommand(['--agent' => ['codex'], '--dry-run' => true])
            ->expectsOutputToContain('Destination:')
            ->assertSuccessful();
        expect(is_dir($project . '/.agents'))->toBeFalse();
        skillCommand(['--agent' => ['codex'], '--no-interaction' => true])->assertSuccessful();
        $entry = $project . '/.agents/skills/sirius-ui-development/SKILL.md';
        file_put_contents($entry, 'Custom instructions');
        skillCommand(['--agent' => ['codex', 'claude-code'], '--no-interaction' => true])->assertFailed();
        expect(file_get_contents($entry))->toBe('Custom instructions');
        expect(is_dir($project . '/.claude'))->toBeFalse();
        skillCommand(['--agent' => ['codex']])
            ->expectsConfirmation('Replace the listed customized files? Originals will be backed up inside each skill directory.', 'no')->assertFailed();
        expect(file_get_contents($entry))->toBe('Custom instructions');
        skillCommand(['--agent' => ['codex']])
            ->expectsConfirmation('Replace the listed customized files? Originals will be backed up inside each skill directory.', 'yes')->assertSuccessful();
        expect(file_get_contents($entry))->toContain('name: sirius-ui-development');
        skillCommand(['--no-interaction' => true])->assertFailed();
        skillCommand(['--agent' => ['cursor'], '--no-interaction' => true])->assertFailed();
    } finally {
        app()->setBasePath($original);
    }
});

it('ships valid portable metadata and resolves every bundled Markdown reference', function (): void {
    $root = dirname(__DIR__, 2) . '/resources/boost/skills/sirius-ui-development';
    $entry = file_get_contents($root . '/SKILL.md');
    expect($entry)->not->toBeFalse();
    if ($entry === false) {
        throw new RuntimeException('Missing skill');
    }
    if (preg_match('/^---\s*\n(.*?)\n---/s', $entry, $header) !== 1) {
        throw new RuntimeException('Missing frontmatter');
    }
    $frontmatter = Yaml::parse($header[1]);
    if (!is_array($frontmatter)) {
        throw new RuntimeException('Invalid frontmatter');
    }
    expect($frontmatter['name'])->toBe('sirius-ui-development');
    expect($frontmatter['description'])->toBeString();
    expect($frontmatter['description'])->not->toBeEmpty();
    foreach ((new Filesystem)->allFiles($root) as $file) {
        preg_match_all('/\]\(([^)#]+\.md)\)/', $file->getContents(), $links);
        foreach ($links[1] as $link) {
            expect(is_file(dirname($file->getPathname()) . '/' . $link))->toBeTrue();
        }
    }
    expect(file_get_contents(dirname(__DIR__, 2) . '/.gitattributes'))->not->toContain('/resources/boost export-ignore', '/resources/boost/skills export-ignore');
});

it('keeps boot passive and rejects missing bundles and changed ownership before applying', function (): void {
    $project = skillProject();
    $original = app()->basePath();
    app()->setBasePath($project);
    try {
        (new SiriusUiServiceProvider(app()))->boot();
        expect(is_dir($project . '/.agents'))->toBeFalse();
        expect(is_dir($project . '/.claude'))->toBeFalse();
    } finally {
        app()->setBasePath($original);
    }
    $files = new Filesystem;
    $installer = new SkillInstaller($files);
    expect(fn (): SkillInstallation => $installer->plan($project, 'codex', $project . '/missing'))->toThrow(RuntimeException::class, 'bundled skill is missing');
    $source = skillSource($project);
    $plan = $installer->plan($project, 'codex', $source);
    $files->ensureDirectoryExists($plan->destination);
    $files->put($plan->destination . '/.sirius-ui-skill.json', 'Changed during preview');
    expect(fn () => $installer->apply($plan))->toThrow(RuntimeException::class, 'manifest changed');
    expect(is_file($plan->destination . '/SKILL.md'))->toBeFalse();
});
