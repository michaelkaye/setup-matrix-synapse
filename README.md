# Matrix synapse test server

<p align="center">
  <a href="https://github.com/michaelkaye/setup-matrix-synapse/actions"><img alt="setup-matrix-synapse status" src="https://github.com/michaelkaye/setup-matrix-synapse/workflows/units-test/badge.svg"></a>
</p>

## Code in Main

Install the dependencies

```bash
npm install
```

Run the tests :heavy_check_mark:

```bash
$ npm test

 PASS  ./index.test.js
  ✓ throws invalid number (3ms)
  ✓ wait 500 ms (504ms)
  ✓ test runs (95ms)
...
```

## Package for distribution

GitHub Actions will run the entry point from the action.yml. Packaging assembles the code into one file that can be checked in to Git, enabling fast and reliable execution and preventing the need to check in node_modules.

Actions are run from GitHub repos.  Packaging the action will create a packaged action in the dist folder.

Run prepare

```bash
npm run prepare
```

Since the packaged index.js is run from the dist folder.

```bash
git add dist
```

## Usage

You can now consume the action by referencing the v1 branch

```yaml
uses: michaelkaye/setup-matrix-synapse@v1
```
