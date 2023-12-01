const core = require('@actions/core');
const exec = require('@actions/exec');
const spawn = require('child_process').spawn;
const fs = require('fs');
const process = require('process');
const http = require('http');

// most @actions toolkit packages have async methods
async function run() {
  try {

    core.info(`Installing synapse...`);
    let installer = core.getInput("installer");
    if (installer == "")
        installer = "pip"

    if (installer == "poetry") {
        // poetry requires a git checkout first
        await exec.exec("git", ["clone", "https://github.com/matrix-org/synapse"]);
        process.chdir("synapse");
        await exec.exec("python", ["-m", "pip", "install","pipx"]);
        await exec.exec("python", ["-m", "pipx", "ensurepath"]);
        await exec.exec("pipx", ["install", "poetry==1.7.1"]);
        await exec.exec("pipx", ["list", "--verbose", "--include-injected"]);
        await exec.exec("poetry", ["install", "-vv", "--extras", "all"]);
    } 
    else {
        // installing from pypi does not need the checkout.
        // Lots of stuff here, from the setting up synapse page.
        await exec.exec("mkdir", ["-p", "synapse"]);
        process.chdir("synapse");
        await exec.exec("python", ["-m", "venv", "env"]);
        await exec.exec("env/bin/pip", ["install", "-q", "--upgrade", "pip"]);
        await exec.exec("env/bin/pip", ["install", "-q", "--upgrade", "setuptools"]);
        await exec.exec("env/bin/pip", ["install", "-q", "matrix-synapse"]);
    }  
    const customModules = core.getInput("customModules")
    if (customModules.length > 0) {
        const toLoad = customModules.split(',');
        for (let module of toLoad) {
            if (installer == "poetry") {
                await exec.exec("poetry", ["add", module]);
            } else {
                await exec.exec("env/bin/pip", ["install", "-q", module]);
            }
        }
    }
    // homeserver.yaml is the default server config from synapse

    core.info("Generating config...");
    if (installer == "poetry") {
        await exec.exec("poetry", [
          "run", "python",
          "-m", "synapse.app.homeserver",
          "--server-name", "localhost",
          "--config-path", "homeserver.yaml",
          "--generate-config",
          "--report-stats=no"
        ]);

    } else {
        await exec.exec("env/bin/python3", [
          "-m", "synapse.app.homeserver",
          "--server-name", "localhost",
          "--config-path", "homeserver.yaml",
          "--generate-config",
          "--report-stats=no"
        ]);
    }

    const port = core.getInput("httpPort");
    var public_baseurl = core.getInput("public_baseurl");
    if (public_baseurl == "") {
       public_baseurl = `http://localhost:${port}`
    }


    // Additional is our customizations to the base homeserver config
    var additional = {
       public_baseurl: public_baseurl,
       enable_registration: true,
       enable_registration_without_verification: true,
       listeners: [
         {
           port: parseInt(port),
           tls: false,
           bind_addresses: ['0.0.0.0'],
           type: 'http',
           resources: [
             {
               names: [ 'client', 'federation'],
               compress: false
             }
           ]
         }
       ]
    };

    const disableRateLimiting = core.getInput("disableRateLimiting");
    if (disableRateLimiting) {
       const rateLimiting = {
         rc_message: {
           per_second: 1000,
           burst_count: 1000
         },
         rc_registration: {
           per_second: 1000,
           burst_count: 1000
         },
         rc_login: {
           address: {
             per_second: 1000,
             burst_count: 1000
           },
           account: {
             per_second: 1000,
             burst_count: 1000
           },
           failed_attempts: {
             per_second: 1000,
             burst_count: 1000
           }
         },
         rc_admin_redaction: {
           per_second: 1000,
           burst_count: 1000
         },
         rc_joins: {
           local: {
             per_second: 1000,
             burst_count: 1000
           },
           remote: {
             per_second: 1000,
             burst_count: 1000
           }
         },
         rc_3pid_validation: {
           per_second: 1000,
           burst_count: 1000
         },
         rc_invites: {
           per_room: {
             per_second: 1000,
             burst_count: 1000
           },
           per_user: {
             per_second: 1000,
             burst_count: 1000
           }
         }
       };
       additional = { ...additional, ...rateLimiting };
    }
    await fs.writeFile("additional.yaml", JSON.stringify(additional, null, 2), 'utf8', (err) => { if (err != null) { core.info(err) }});

    // And finally, customConfig is the user-supplied custom config, if required

    const customConfig = core.getInput("customConfig");
    await fs.writeFile("custom.yaml", customConfig, 'utf8', (err) => { if (err != null) { core.info(err) }});

    // Add listeners
    // Disable ratelimiting
    // etc

    // Ensure all files we pick up as logs afterwards are at least on disk
    await exec.exec("touch", [
      "out.log",
      "err.log",
      "homeserver.log",
      "homeserver.yaml",
      "additional.yaml",
      "custom.yaml"
    ]);

    core.info(`Starting synapse ...`);
    const out = fs.openSync('out.log', 'a');
    const err = fs.openSync('err.log', 'a');
    const options = {
      detached: true,
      stdio: [ 'ignore', out, err ]
    }
    var child;
    if (installer == "poetry" ) {
        child = spawn("poetry", [
          "run", "python", 
          "-m", "synapse.app.homeserver",
          "--config-path", "homeserver.yaml",
          "--config-path", "additional.yaml",
          "--config-path", "custom.yaml"
        ], options);
    } else {
        child = spawn("env/bin/python3", [
          "-m", "synapse.app.homeserver",
          "--config-path", "homeserver.yaml",
          "--config-path", "additional.yaml",
          "--config-path", "custom.yaml"
        ], options);
    }
    core.saveState("synapse-pid", child.pid);
    core.info(`Waiting until C-S api is available`);


    const url = `http://localhost:${ port }/_matrix/client/versions`;
    var retry = 0;
    while (retry < 20) {
      core.info("Checking endpoint...");
      const response = await checkFor200(url);
      core.info(`.. got ${response}`);
      if (response == 200 ) {
         break;
      }
      if (retry++ == 10) {
         core.setFailed("Unable to start synapse in 60s");
         break;
      }
      else {
         await sleep(6000);
         continue;
      }
    }

    // drop nodejs references to the synapse child process, so we can exit cleanly
    child.unref();

    // Action directory is not in the root; provide an output with the synapse folder we're using
    core.saveState("synapse-dir", process.cwd());
    core.setOutput("synapse-url", `http://localhost:${ port }/`);
  } catch (error) {
    core.setFailed(error.message);
  }
}

// Short timeout because we have a larger retry loop around it
// And the server should respond within ~500ms or is generally unhappy anyway
async function checkFor200(target) {
  return new Promise((resolve) => {
 
    const req = http.get(target, {timeout: 500}, (res) => {
       resolve(res.statusCode);
    }).on('timeout', () => {
       req.abort();
       resolve(0);
    }).on('error', () => {
       resolve(0);
    });
    req.end();
  });
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

run();
