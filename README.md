# Unfurl Asana URLs in PR Bodies

## What does this do?

This GitHub Action enhances Pull Request bodies by replacing Asana task URLs with markdown links that include the task title. It performs the following:

1. Searches PR bodies for Asana URLs (plain URLs and existing markdown links)
2. Fetches the task title for each Asana task ID found
3. Converts plain URLs into markdown links: `[Task Title](https://app.asana.com/...)`
4. Updates the text of existing markdown links to match the current task title

The action is smart enough to:

- Only update the PR body if there are meaningful changes
- Handle all common Asana URL formats
- Update task titles for existing links while preserving the link format

## Development of this GitHub Action

Use GitHub Codespaces to develop this in-browser. There's an existing codespace already set up.

Save your changes and commit the build artifacts:

```
nvm use && npm install && npm run build && npm run package && git add -A && git commit && git push origin main
```

Upon pushing to any branch, you'll trigger an automatic release

## Using this Github Action from another repo

_Make sure to allow Github Actions from the respective repo you want this Github Action to operate on._

Include a Github Workflow file in the respective repo:

.github/workflows/unfurl-asana-urls-in-pr-bodies.yml

```yaml
name: Unfurl Asana URLs

on:
  pull_request:
    types: [opened, reopened, edited]

jobs:
  unfurl-asana-urls:
    name: Unfurl Asana URLs in PR Body
    runs-on: 'ubuntu-latest'

    steps:
      - name: Checkout repo
        uses: actions/checkout@v3
      - name: Unfurl Asana URLs
        uses: 'yourusername/unfurl-asana-urls-in-pr-bodies-action@latest'
        with:
          asanaToken: ${{ secrets.ASANA_TOKEN }}
          githubToken: ${{ github.token }}
```

## Inputs

| Input         | Required | Description                                     |
| ------------- | -------- | ----------------------------------------------- |
| `githubToken` | Yes      | GitHub token for PR access                      |
| `asanaToken`  | Yes      | Asana API token for retrieving task information |

## Outputs

| Output         | Description                                               |
| -------------- | --------------------------------------------------------- |
| `updated`      | Whether the PR body was updated (`true`) or not (`false`) |
| `updatedCount` | The number of Asana links that were processed and updated |

## Examples

### Before:

```
This PR addresses the issues in https://app.asana.com/0/12345/67890

Also fixes [another task](https://app.asana.com/0/12345/54321)
```

### After:

```
This PR addresses the issues in [Fix login error on mobile devices](https://app.asana.com/0/12345/67890)

Also fixes [Add user profile settings page](https://app.asana.com/0/12345/54321)
```
