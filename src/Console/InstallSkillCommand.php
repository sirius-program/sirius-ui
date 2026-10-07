<?php

declare(strict_types=1);

namespace Sirius\Ui\Console;

use Illuminate\Console\Command;
use RuntimeException;
use Sirius\Ui\Support\SkillInstaller;

final class InstallSkillCommand extends Command
{
    protected $signature = 'sirius:skills:install {--agent=* : Explicit target: codex or claude-code} {--dry-run : Preview without writing files}';

    protected $description = 'Install or update the bundled Sirius UI skill in selected project-local agents';

    public function handle(SkillInstaller $installer): int
    {
        $agents = $this->option('agent');
        if ($agents === []) {
            $this->error('Select at least one agent: --agent=codex or --agent=claude-code.');

            return self::FAILURE;
        }
        try {
            $plans = [];
            foreach (array_unique($agents) as $agent) {
                if (!is_string($agent)) {
                    throw new RuntimeException('Agent names must be strings.');
                }
                $plan = $installer->plan(base_path(), $agent);
                $this->line('Destination: ' . $plan->destination);
                $rows = [];
                foreach ($plan->changes as $path => $change) {
                    $rows[] = [$change['action'], $path];
                }
                $rows[] = ['track ownership', '.sirius-ui-skill.json'];
                $this->table(['Change', 'File'], $rows);
                $plans[] = $plan;
            }
            if ($this->option('dry-run')) {
                return self::SUCCESS;
            }
            $replace = false;
            foreach ($plans as $plan) {
                if ($plan->hasConflicts()) {
                    if (!$this->input->isInteractive() || !$this->confirm('Replace the listed customized files? Originals will be backed up inside each skill directory.', false)) {
                        throw new RuntimeException('Customized files preserved; no files were installed. Review with --dry-run, then run interactively to confirm replacement.');
                    }
                    $replace = true;
                    break;
                }
            }
            foreach ($plans as $plan) {
                $installer->apply($plan, $replace);
            }
            $this->info('Sirius UI skill installed. Start a new agent session to discover the updated skill.');

            return self::SUCCESS;
        } catch (RuntimeException $exception) {
            $this->error($exception->getMessage());

            return self::FAILURE;
        }
    }
}
