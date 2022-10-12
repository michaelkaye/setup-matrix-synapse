const core = require('@actions/core');
const process = require('process');
const artifact = require('@actions/artifact');

// most @actions toolkit packages have async methods
async function run() {
  try {
    core.info(`Destroying synapse ...`);
    var pid = core.getState("synapse-pid");
    var cwd = core.getState("synapse-dir");
    // Polite termination is for those without pull requests to merge.
    try {
      process.kill(pid, 15);
      await sleep(10000);
      try {
        process.kill(pid, 9);
        core.warn("Synapse did not shutdown in 10s. Terminating");
      } catch(e) {
        // expected that synapse PID is not available to be terminated here.
      }
    } catch(e) {
      core.error("Synapse was no-longer running at teardown time")
    }

    // Tidy up the synapse directory to contain only log files
    // (useful for an artifact upload)
    const upload = core.getBooleanInput('uploadLogs', {required: true});
    if (upload) {
      const artifactName = core.getInput('artifactName');
      const artifactClient = artifact.create();
      const files = [
        `${cwd}/homeserver.yaml`,
        `${cwd}/homeserver.log`,
        `${cwd}/custom.yaml`,
        `${cwd}/additional.yaml`,
        `${cwd}/out.log`,
        `${cwd}/err.log`
      ];
        
      const rootDirectory = `${cwd}`;
      const options = {
        continueOnError: true
      }
      await artifactClient.uploadArtifact(artifactName, files, rootDirectory, options);
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}


run();
