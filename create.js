const core = require('@actions/core');
const exec = require('@actions/exec');
const spawn = require('child_process').spawn;
const fs = require('fs');
const process = require('process');

// most @actions toolkit packages have async methods
async function run() {
  try {

    core.info(`Installing synapse...`);
    
    // Lots of stuff here, from the setting up synapse page.
    await exec.exec("mkdir", ["-p", "synapse"]);
    process.chdir("synapse");
    await exec.exec("python", ["-m", "venv", "env"]);
    await exec.exec("env/bin/pip", ["install", "-q", "--upgrade", "pip"]);
    await exec.exec("env/bin/pip", ["install", "-q", "--upgrade", "setuptools"]);
    await exec.exec("env/bin/pip", ["install", "-q", "matrix-synapse"]);
    
    core.info("Generating config...");

    await exec.exec("env/bin/python3", [
      "-m", "synapse.app.homeserver",
      "--server-name", "localhost",
      "--config-path", "homeserver.yaml",
      "--generate-config",
      "--report-stats=no"
    ]);

    const additional = {};


    await fs.writeFile("additional.yaml", JSON.stringify(additional), 'utf8', (err) => { core.info(err)});

    // Add listeners
    // Disable ratelimiting
    // etc

    // Ensure all files we pick up as logs afterwards are at least on disk
    await exec.exec("touch", ["out.log", "err.log", "homeserver.log", "homeserver.yaml", "additional.yaml"]);

    core.info(`Starting synapse ...`);
    const out = fs.openSync('out.log', 'a');
    const err = fs.openSync('err.log', 'a');
    const options = {
      detached: true,
      stdio: [ 'ignore', out, err ]
    }
    var child = spawn("env/bin/python3", [
      "-m", "synapse.app.homeserver",
      "--config-path", "homeserver.yaml",
      "--config-path", "additional.yaml"
    ], options);
 
    core.saveState("synapse-pid", child.pid);
    core.info(`Waiting until C-S api is available`);
    // TODO poll http endpoint
    // drop nodejs references to the synapse child process, so we can exit cleanly
    child.unref();

    // Action directory is not in the root; provide an output with the synapse folder we're using
    core.setOutput("synapse-logs", process.cwd());
    core.setOutput("synapse-url", "http://localhost:8080/");
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
