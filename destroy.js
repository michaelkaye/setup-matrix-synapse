const core = require('@actions/core');
const exec = require('@actions/exec');
const process = require('process');
const artifact = require('@actions/artifact');

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
    const upload = core.getBooleanInput('uploadLogs', {required: true});
    if (upload) {
      const artifactName = core.getInput('artifactName');
      const artifactClient = artifact.create();
      const cwd = process.cwd();
      const files = [
        `{cwd}/synapse/homeserver.yaml`,
        `{cwd}/synapse/homeserver.log`,
        `{cwd}/synapse/additional.yaml`,
        `{cwd}/synapse/out.log`,
        `{cwd}/synapse/err.log`
      ];
        
      const rootDirectory = `{cwd}/synapse`;
      const options = {
        continueOnError: true
      }
      const uploadResult = await artifactClient.uploadArtifact(artifactName, files, rootDirectory, options);
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
