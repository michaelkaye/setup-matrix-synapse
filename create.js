const core = require('@actions/core');
const exec = require('@actions/exec');
const spawn = require('child_process').spawn;
const fs = require('fs');

// most @actions toolkit packages have async methods
async function run() {
  try {

    core.info(`Installing synapse...`);
    
    // Lots of stuff here, from the setting up synapse page.
    await exec.exec("mkdir", ["-p", "synapse"]);
    await exec.exec("python3" ["-m", "venv", "-p", "python3", "synapse/env"]);
    await exec.exec("ls", ["-R"]);
    await exec.exec("synapse/env/bin/pip", ["install", "--upgrade", "pip"]);
    await exec.exec("synapse/env/bin/pip", ["install", "--upgrade", "setuptools"]);
    await exec.exec("synapse/env/bin/pip", ["install", "matrix-synapse"]);
    
    core.info("Generating config...");

    await exec.exec("synapse/env/bin/python3", ["-m", "synapse.app.homeserver", "--server-name", "localhost", "--config-path", "synapse/homeserver.yaml", "--generate-config", "--report-stats=no"]);
    // TODO customize synapse
    // Add listeners
    // Disable ratelimiting
    // etc

    core.info(`Starting synapse ...`);
    // avoid exec.exec as we want to run in background
    await exec.exec("touch", ["synapse/out.log"]);
    await exec.exec("touch", ["synapse/err.log"]);
    const out = fs.openSync('synapse/out.log', 'a');
    const err = fs.openSync('synapse/err.log', 'a');
    const options = {
	  detached: true,
      stdio: [ 'ignore', out, err ]
    }
    var child = spawn("synapse/env/bin/python3", ["-m", "synapse.app.homeserver", "--config-path", "synapse/homeserver.yaml"], options);
 
    core.saveState("synapse-pid", child.pid);
    core.info(`Waiting until C-S api is available`);
    // TODO poll http endpoint
    // drop nodejs references to the synapse child process, so we can exit cleanly
    child.unref();
    
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
