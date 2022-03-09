const core = require('@actions/core');
const exec = require('@actions/exec');
const process = require('process');

// most @actions toolkit packages have async methods
async function run() {
  try {
    core.info(`Destroying synapse ...`);
    var pid = core.getState("synapse-pid");
    // Polite termination is for those without pull requests to merge.
    process.kill(pid, 9);
    core.info(`... process killed ...`);

    // Tidy up the synapse directory to contain only log files
    // (useful for an artifact upload)
    await exec.exec("rm", ["-r", "synapse/homeserver.db", "synapse/media_store", "synapse/env"]);
    core.info(`... synapse folder prepared for artifact upload.`);

  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
