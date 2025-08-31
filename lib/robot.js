const { Agent } = require('./agent/agent');
const { Server } = require('./master/server');
const { HTTP_SERVER } = require('./console/http');
require('./common/util').createPath();

/**
 * Represents the main Robot instance that can run in Master or Agent mode.
 */
class Robot {
    /**
     * @param {object} conf - The configuration object for the robot.
     */
    constructor(conf) {
        this.conf = conf;
        this.master = null;
        this.agent = null;
    }

    /**
     * Run the robot in master server mode.
     * @param {string} mainFile - The path to the main startup script.
     */
    runMaster(mainFile) {
        const conf = {
            clients: this.conf.clients,
            mainFile: mainFile
        };
        this.master = new Server(conf);
        this.master.listen(this.conf.master.port);
        HTTP_SERVER.start(this.conf.master.webport);
    }

    /**
     * Run the robot in agent client mode.
     * @param {string} scriptFile - The path to the custom script the agent will execute.
     */
    runAgent(scriptFile) {
        const conf = {
            master: this.conf.master,
            apps: this.conf.apps,
            script: scriptFile // Pass the script path to the agent configuration
        };
        this.agent = new Agent(conf);
        this.agent.start();
    }

    /**
     * Force the agent to reconnect to the master.
     */
    restart() {
        if (this.agent) {
            this.agent.reconnect(true);
        }
    }
}

exports.Robot = Robot;
