const io = require('socket.io-client');
const logging = require('../common/logging').Logger;
const { Actor } = require('./actor');
const monitor = require('../monitor/monitor');
const util = require('../common/util');

const STATUS_INTERVAL = 10 * 1000; // 10 seconds
const RECONNECT_INTERVAL = 10 * 1000; // 10 seconds
const HEARTBEAT_PERIOD = 30 * 1000; // 30 seconds
const HEARTBEAT_FAILS = 3; // Reconnect after 3 missed heartbeats

class Agent {
    constructor(conf) {
        this.log = logging;
        this.conf = conf || {};
        this.last_heartbeat = null;
        this.connected = false;
        this.reconnecting = false;
        this.actors = {};
        this.count = 0;
    }

    // Create socket, bind callbacks, connect to server
    connect() {
        const uri = `http://${this.conf.master.host}:${this.conf.master.port}`;
        // Use io() directly, as io.connect() is deprecated in socket.io-client v3+
        this.socket = io(uri, {
            forceNew: true, // Replaces 'force new connection'
            transports: ['websocket'], // More explicit than 'try multiple transports': false
            reconnection: false
        });

        this.socket.on('error', (reason) => {
            this.log.error(`Socket error: ${reason}`);
            this.reconnect();
        });

        // Register announcement callback
        this.socket.on('connect', () => {
            this.log.info("Connected to server, sending announcement...");
            this.announce();
            this.connected = true;
            this.reconnecting = false;
            this.last_heartbeat = new Date().getTime();
        });

        this.socket.on('disconnect', (reason) => {
            this.log.error(`Disconnected from server: ${reason}`);
            this.connected = false;
            // The project has its own reconnection logic, so we don't call reconnect() here.
        });

        // Server heartbeat
        this.socket.on('heartbeat', () => {
            this.last_heartbeat = new Date().getTime();
        });

        // Node with same label already exists on server, kill process
        this.socket.on('node_already_exists', () => {
            this.log.error("ERROR: A node of the same name is already registered. Exiting.");
            process.exit(1);
        });

        //begin to run
        this.socket.on('run', (message) => {
            this.run(message);
        });

        // Exit for BTN_ReReady
        this.socket.on('exit4reready', () => {
            this.log.info("Exit for BTN_ReReady.");
            process.exit(0);
        });
    }

    run(msg) {
        util.deleteLog();
        this.count = msg.maxuser;
        const { script, index } = msg;
        if (script && script.length > 1) {
            this.conf.script = script;
        }
        this.log.info(`${this.nodeId} runs ${this.count} actors`);
        monitor.clear();
        this.actors = {};
        const offset = index * this.count;
        for (let i = 0; i < this.count; i++) {
            const aid = i + offset;
            const actor = new Actor(this.conf, aid);
            this.actors[aid] = actor;

            actor.on('error', (error) => {
                this.socket.emit('error', error);
            });

            if (this.conf.master.interval <= 0) {
                actor.run();
            } else {
                const time = Math.round(Math.random() * 1000 + i * this.conf.master.interval);
                setTimeout(() => {
                    actor.run();
                }, time);
            }
        }

        setInterval(() => {
            const mdata = monitor.getData();
            this.socket.emit('report', mdata);
        }, STATUS_INTERVAL);
    }

    // Run agent
    start() {
        this.connect();
        // Check for heartbeat every HEARTBEAT_PERIOD, reconnect if necessary
        setInterval(() => {
            if (this.last_heartbeat === null) return;
            const delta = Date.now() - this.last_heartbeat;
            if (delta > (HEARTBEAT_PERIOD * HEARTBEAT_FAILS)) {
                this.log.warn("Failed heartbeat check, reconnecting...");
                this.connected = false;
                this.reconnect();
            }
        }, HEARTBEAT_PERIOD);
    }

    // Sends announcement 
    announce() {
        const sessionid = this.socket.id;
        this.nodeId = sessionid;
        this._send('announce_node', {
            client_type: 'node',
            nodeId: sessionid
        });
    }

    // Reconnect helper, retry until connection established
    reconnect(force) {
        if (!force && this.reconnecting) { return; }
        this.reconnecting = true;
        if (this.socket) {
            this.socket.disconnect();
        }
        this.connected = false;
        this.log.info("Reconnecting to server...");
        setTimeout(() => {
            if (this.connected) {
                this.reconnecting = false;
                return;
            }
            this.connect();
        }, RECONNECT_INTERVAL);
    }

    _send(event, message) {
        try {
            if (this.socket) {
                this.socket.emit(event, message);
            }
        } catch (err) {
            this.log.error("ERROR: Unable to send message over socket.");
            this.connected = false;
            this.reconnect();
        }
    }
}

exports.Agent = Agent;
