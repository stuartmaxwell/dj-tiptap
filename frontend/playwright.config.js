import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  use: {
    baseURL: "http://127.0.0.1:8010",
  },
  // Start a Django server against the test settings: bring the throwaway
  // test database's schema current, empty it, then serve.
  webServer: {
    command:
      "pdm run python manage.py migrate --settings=config.settings_testing && " +
      "pdm run python manage.py flush --noinput --settings=config.settings_testing && " +
      "pdm run python manage.py runserver 8010 --noreload --settings=config.settings_testing",
    cwd: "../example",
    url: "http://127.0.0.1:8010/",
    // Never reuse a server: one already on this port could be the normal dev
    // server pointing at the real database.
    reuseExistingServer: false,
  },
});
