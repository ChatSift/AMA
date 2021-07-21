<div align="center">
  <img width="300" height="300" src="https://sucks-to-b.eu/xFTlWA.png">

  <p align="center">
    <br />
    <h3>
      <strong>
        <a href="https://gaiusbot.me/ama">Read more about it here</a>
      </strong>
    </h2>
  </p>

  <p>
    <img src="https://github.com/ChatSift/AMA/actions/workflows/quality.yml/badge.svg" alt="Quality Check">
    <a href="https://github.com/ChatSift/AMA/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-GNU%20AGPLv3-yellow.svg" alt="License: GNU AGPLv3"></a>
    <a href="https://github.com/ChatSift/AMA/issues"><img src="https://img.shields.io/github/issues-raw/ChatSift/AMA.svg?maxAge=25000" alt="Issues"></a>
    <a href="https://github.com/ChatSift/AMA/pulls"><img src="https://img.shields.io/github/issues-pr/ChatSift/AMA.svg?style=flat" alt="GitHub pull requests"></a>
  </p>

  <br>
</div>

# Self hosting
For a start, a working, securely configured Docker installation is required. You can find OS-specific instructions for that [here](https://docs.docker.com/get-docker/).

You're also going to need a `docker-compose` install, which you can find out more about [here](https://docs.docker.com/compose/install/).

With those prerequisites out of the way, you're now ready to clone the repository or download the source code.

Create a `docker-compose.config.yml` file (which you can find an example for [here](https://github.com/ChatSift/AMA/blob/main/docker-compose.config.example.yml)).

You can retrieve the `DISCORD_TOKEN` and `DISCORD_PUB_KEY` from the developer portal.

You should generate an `ENCRYPTION_KEY` however you wish to - with a Node.js install that'd look something like
```sh
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Make sure either `a.ps1` (Windows) or `a.sh` (Linux/macOS) are executable.

With that out of the way, you can finally deploy the app to production, using the following commands (make sure to use the appropriate script for your system):
```sh
./a.sh prod build
./a.sh prod up -d
```

# Contributing
We make use of [`PNPM`](https://pnpm.js.org/) to manage our monorepo setup. It is expected that you have an up-to-date version of it. 

Please ensure you run `pnpm run lint`, `pnpm run build`, and `pnpm run test` in the root before pushing your commits.

Please ensure that you follow our [Code Of Conduct](https://github.com/ChatSift/ama/blob/main/.github/CODE_OF_CONDUCT.md).

If all checks out, [Submit a Pull Request](https://github.com/ChatSift/ama/compare)

# Inspiration
Big props to [Yuudachi](https://github.com/Naval-Base/yuudachi) for the general interactions handler structure.

# LICENSING

This repository is licensed under the GNU AGPLv3 license.
