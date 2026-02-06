# Repository Guidelines

## Project Structure & Module Organization
- `signal-api-to-inbox`: Node.js CLI entry that loads config and runs the processor from `src/` against `signal-cli-rest-api`.
- `signal-cli-to-inbox`: Currently not in use. Ignore.
- `src/processor.js`: Pure processing module (file naming, note/attachment handling, message processing) exposed via `createProcessor`.
- `tests/`: Jest tests (unit and integration) for the processor layer.
- `tests/fixtures/`: Fixture JSON and binary stubs for integration tests.
- `jest.config.js`: Minimal Jest configuration.
- `package.json`: Dev dependency and `npm test` script for Jest.
- `README.md`: Setup, configuration notes, and usage context.
- `demo.png`: Example output screenshot.

This is a small repo with standalone scripts and a shared processor module.

## Build, Test, and Development Commands
- `./signal-api-to-inbox`: Run the REST API script (requires Node.js and configured constants in the file).
- `./signal-cli-to-inbox`: Run the signal-cli script (requires `signal-cli` installed and variables configured).
- `make import`: Copies a local script into `signal-api-to-inbox` (developer convenience for the maintainer).
- `npm test`: Run Jest tests in `tests/`.

There is no build step or bundler; tests are run via Jest.

## Coding Style & Naming Conventions
- Indentation is 4 spaces in `signal-api-to-inbox` (keep consistent).
- Prefer descriptive constants for configuration at the top of scripts (e.g., `apiHost`, `inboxDir`).
- Filenames and functions use lowerCamelCase in JS and snake_case in shell.
- No formatter or linter is wired up; keep edits minimal and readable.
- Prefer double quotes over single quotes.
- Don't add any comments, use descriptive variable names instead
- In variable names don't shorten term length name (e.g. "description" instead of "desc", "index instead of "idx"). In arrow functions shorthands may be use.
- Prefer creating a new component instead of adding a bunch of JSX to an existing component. Only do this if the new component is actually a distinct unit.

## Testing Guidelines
- Automated tests live in `tests/` and should focus on processor functions (file naming, message handling, attachments).
 - Always run `npm test` (or `make test`) after making source code changes.
- Keep fixture data in `tests/fixtures/` as close to production responses as possible; mock the attachments endpoint rather than altering fixtures.
- Manual checks should cover: message-only, attachments, long message attachment, whitelist behavior, and file naming rules.
- Use a controlled inbox directory when testing to avoid polluting real notes.

## Security & Configuration Tips
- Both scripts include hardcoded configuration values. Do not commit secrets or private paths.
- Validate `inboxDir` paths and whitelist entries before running via cron.
