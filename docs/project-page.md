# SQL/REPL project page

The project page is hosted at https://fl1034.github.io/sql-repl/.

In the repository's **Settings → Pages**, choose **GitHub Actions** as the build
and deployment source. The **Deploy project page** workflow runs on pushes to
`main` and can also be started manually from the Actions tab. Its build job runs
lint, formatting, type checking, unit tests, and a production build. Its deploy
job publishes the build using GitHub's Pages artifact and deployment actions.
No deployment token or application secret needs to be added to the repository.

The workflow sets `DUCK_UI_BASEPATH=/sql-repl/` through the repository name. To
reproduce that build locally:

```sh
bun install --frozen-lockfile
DUCK_UI_BASEPATH=/sql-repl/ bun run build
```

Serve `dist/` at `/sql-repl/` when verifying the project build. The core browser
SQL workflow works without custom HTTP headers; storage uses IndexedDB on hosts
that do not provide cross-origin isolation. Queries and color choices stay in
the visitor's browser. Custom color choices override the new defaults; use
**Reset colors** in the palette to return to the shipped syntax colors.
