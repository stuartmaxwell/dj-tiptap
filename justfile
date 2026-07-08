# Set the default recipe to list all available commands
default:
    @just --list

# Create and/or update the lockfile with the latest packages. Note that the "--exclude-newer 7d" option will be added when released.
lock:
  pdm lock

# Install/sync packages in the virtual environment
sync:
  pdm sync --clean

# Run the Django development server
run:
    pdm run example/manage.py runserver

# Make migrations
makemigrations:
    pdm run example/manage.py makemigrations

# Apply migrations
migrate:
    pdm run example/manage.py migrate

# Create a superuser
createsuperuser:
    pdm run example/manage.py createsuperuser

# Collect static files
collectstatic:
    pdm run example/manage.py collectstatic

# Run Django shell
shell:
    pdm run example/manage.py shell

# Check for any problems in your project
check:
    pdm run example/manage.py check

# Generic manage command
manage *ARGS:
    pdm run example/manage.py {{ARGS}}

# Run the full test suite, including the Playwright browser tests
test *ARGS:
    pdm run pytest {{ARGS}}

# Run only the fast Python tests (skips the Playwright browser tests)
test-fast *ARGS:
    pdm run pytest -m "not e2e" {{ARGS}}

# Install pre-commit hooks
pc-install:
    pre-commit install

# Upgrade pre-commit hooks
pc-up:
    pre-commit autoupdate

# Run pre-commit hooks
pc-run:
    pre-commit run --all-files
