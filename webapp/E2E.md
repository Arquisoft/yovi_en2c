# E2E tests (Playwright + Cucumber)

This project includes a simple BDD-style E2E setup that uses Playwright for browser automation and Cucumber (`@cucumber/cucumber`) for Gherkin feature files.

Quick commands:

- Install Playwright browsers (once):

  ```bash
  npm run test:e2e:install-browsers
  ```

- Run E2E tests (requires the full backend stack minus the botapi: users, authentication, gateway and gamey services):

  - Start both dev servers and run tests automatically:

    ```bash
    npm run test:e2e:dev
    ```

  - Or, start the dev server yourself (`npm run dev`) and the users service (`(cd ../users && npm start), (cd ../authentication && npm start), (cd ../gateway && npm start), (cd ../gamey && cargo run -- --mode server --port 4000)`) then run:

    ```bash
    npm run test:e2e
    ```

Files of interest:
- `test/e2e/features` - Gherkin feature files (authentication, game, stats, i18n, etc.)
- `test/e2e/steps` - step definitions
- `test/e2e/support` - Cucumber World and Playwright hooks

Run tests in a visible browser / slow motion

- Run tests with a visible browser (headed):

  ```bash
  npm run test:e2e:headed
  ```

- Run tests in visible slow motion (helpful to watch actions):

  ```bash
  npm run test:e2e:slow
  ```

- Debug mode (headed + slow motion + open devtools):

  ```bash
  npm run test:e2e:debug
  ```

### Mocking

Some E2E tests mock backend endpoints using Playwright's `page.route`, for example:

- `/api/stats/:username` (statistics tests)
- `/api/game/*` (game flow tests)

This allows deterministic scenarios such as:
- finished games
- empty statistics
- server errors


### Covered scenarios

E2E tests currently cover:

- Authentication (register, login, validation)
- Session persistence
- Profile and social features
- Game flow (start, moves, end game)
- Difficulty and board selection
- Statistics (data, empty state, error handling)
- Internationalization (language toggle)
- Navigation (home, instructions, profile)

Notes:
- For CI, ensure Playwright browsers are installed (e.g. `npx playwright install --with-deps`).
- The `test:e2e:dev` script uses `concurrently` to start both Vite and the `users` service and then runs the Cucumber tests.
- Some tests intentionally use invalid tokens to verify authentication behavior. This may produce JWT warnings in the console, which are expected.