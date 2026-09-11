<?php

declare(strict_types=1);

try {
    if (PHP_OS_FAMILY !== 'Windows') {
        runTyposChecking();
    }

    runClearCache();
    runLintChecking();
    runTypeChecking();
    runRefactorChecking();
    runTests();

    echoSuccess('All checks passed!' . "\n");
} catch (Throwable $throwable) {
    echoError($throwable->getMessage() . "\n");
    echoWarning('Please run "composer test" again after you fix the issue.' . "\n\n");
    exit(1);
}

// Echo

function echoWarning(string $message): void
{
    echo "\033[33m" . $message . "\033[0m";
}

function echoError(string $message): void
{
    echo "\033[31m" . $message . "\033[0m";
}

function echoSuccess(string $message): void
{
    echo "\033[32m" . $message . "\033[0m";
}

function echoInfo(string $message): void
{
    echo "\033[34m" . $message . "\033[0m";
}

// Run Checking

function runClearCache(): void
{
    runCommand(
        message: 'Clearing cache...',
        command: 'php vendor/bin/testbench config:clear --ansi --no-interaction',
        failureMessage: 'Failed clearing cache.',
    );
}

function runLintChecking(): void
{
    runCommand(
        message: 'Lint checking...',
        command: 'composer lint:check',
        failureMessage: 'Failed lint checking, try running "composer lint" to fix it.',
    );
}

function runTypeChecking(): void
{
    runCommand(
        message: 'Type checking...',
        command: 'composer types:check',
        failureMessage: 'Failed type checking.',
    );
}

function runRefactorChecking(): void
{
    runCommand(
        message: 'Refactor checking...',
        command: 'composer refactor:check',
        failureMessage: 'Failed refactor checking, try running "composer refactor" to fix it.',
    );
}

function runTyposChecking(): void
{
    runCommand(
        message: 'Typos checking...',
        command: 'composer typos:check',
        failureMessage: 'Failed typo checking, try running "composer typos" to update the ignore list.',
    );
}

function runTests(): void
{
    runCommand(
        message: 'Running tests...',
        command: 'php vendor/bin/pest --compact --parallel',
        failureMessage: 'Some tests are failing. Please fix them first.',
    );
}

function runCommand(string $message, string $command, string $failureMessage): void
{
    echoInfo($message . "\n");

    system($command, $exitCode);

    if ($exitCode !== 0) {
        throw new RuntimeException($failureMessage);
    }
}
