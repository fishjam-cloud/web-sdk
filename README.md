<img src="./.github/images/fishjam-card.png" width="100%">

# Fishjam Cloud Web Client

React and TypeScript client libraries for [Fishjam Cloud](https://fishjam.io).

## Documentation

Documentation is available [here](https://fishjam-cloud.github.io/documentation/guide/category/react-integration). There
is also API documentation [here](https://fishjam-cloud.github.io/web-client-sdk/).

### React Library:

[React library](https://github.com/fishjam-cloud/web-client-sdk/tree/main/packages/react-client) is useful for projects
that uses React. It is wrapper over TypeScript library, that provides React integration.

Check out [docs](https://fishjam-cloud.github.io/documentation/guide/category/react-integration) for more information.

### TypeScript Library:

[TypeScript library](https://github.com/fishjam-cloud/web-client-sdk/tree/main/packages/ts-client) is useful for
projects that do not use React. Or if you want to have more control on how all streaming events are handled.

> [!NOTE]  
> TypeScript SDK is not stable yet. We recommend using React Client

Check out [docs](https://fishjam-cloud.github.io/web-client-sdk/modules/_fishjam_cloud_ts_client.html) for more
information.

## Contributing

Contributions are always welcome, no matter how large or small!

We aspire to build a community that is friendly and respectful to each other. Please adhere to this spirit in all your
interactions within the project.

### Development Workflow

To get started with the project, run npm install in the root directory to install the required dependencies and build
TypeScript:

```bash
yarn
yarn build
```

Ensure your code passes TypeScript, ESLint and formatter checks by running the following commands:

```
yarn tsc
yarn lint:check
yarn format:check
```

To lint and format your code, use the following commands:

```bash
yarn lint
yarn format
```

## Submitting a Pull Request

> **Working on your first pull request?** Get started with this _free_ series:
> [How to Contribute to an Open Source Project on GitHub](https://app.egghead.io/playlists/how-to-contribute-to-an-open-source-project-on-github).

When you're sending a pull request:

- Focus on one change and try to keep pull requests small.
- Make sure that formatter, linter and test checks are passing.
- Review the documentation to make sure it looks good.
- Follow the pull request template when opening a pull request.
- If your pull request changes the API or implementation, first discuss the changes with the maintainers by opening an
  issue.

## Copyright and License

Copyright 2024,
[Software Mansion](https://swmansion.com/?utm_source=git&utm_medium=readme&utm_campaign=fishjam-web-client)

[![Software Mansion](https://logo.swmansion.com/logo?color=white&variant=desktop&width=200&tag=fishjam-github)](https://swmansion.com/?utm_source=git&utm_medium=readme&utm_campaign=fishjam-web-client)

Licensed under the [Apache License, Version 2.0](LICENSE)
