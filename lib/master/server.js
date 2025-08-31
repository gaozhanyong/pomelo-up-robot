const { Server: SocketIOServer } = require('socket.io');
const { NodeClient } = require('./nodeclient.js');
const { WebClient } = require('./webclient.js');
const logging = require('../common/logging').Logger;
const stat = require('../monitor/stat');
const starter = require('./starter');

const STATUS_INTERVAL = 60 * 1000; // 60 seconds
const HEARTBEAT_INTERVAL = 30 * 1000; // 30 seconds
const STATUS_IDLE = 0;
const STATUS_READY = 1;
const STATUS_RUNNING = 2;

class Server {
    constructor(conf) {
        this.log = logging;
        this.nodes = {};
        this.web_clients = {};
        this.conf = conf || {};
        this.runconfig = null;
        this.status = STATUS_IDLE;

        setInterval(() => {
            this.log.info(`Nodes: ${Object.keys(this.nodes).length}, WebClients: ${Object.keys(this.web_clients).length}`);
        }, STATUS_INTERVAL);
    }

    listen(port) {
        this.io = new SocketIOServer(port, {
            allowEIO3: true, // Enable backward compatibility for Engine.IO v3 (socket.io v2 clients)
            cors: {
                origin: (origin, callback) => {
                    // For a local development tool, reflecting the origin is a safe and flexible approach.
                    callback(null, origin);
                },
                methods: ["GET", "POST"],
                credentials: true
            }
        });
        this.register();
    }

    announce_node(socket, message) {
        const { nodeId } = message;
        if (this.nodes[nodeId]) {
            this.log.warn(`Warning: Node '${nodeId}' already exists, deleting old items`);
            socket.emit('node_already_exists');
            delete this.nodes[nodeId];
        }

        const node = new NodeClient(nodeId, socket, this);
        this.nodes[nodeId] = node;

        Object.values(this.web_clients).forEach(web_client => {
            web_client.add_node(node);
        });

        socket.on('disconnect', () => {
            delete this.nodes[nodeId];
            Object.values(this.web_clients).forEach(web_client => {
                web_client.remove_node(node);
            });
            if (Object.keys(this.nodes).length <= 0) {
                this.status = STATUS_IDLE;
            }
            stat.clear(nodeId);
        });

        socket.on('report', (message) => {
            stat.merge(nodeId, message);
        });

        socket.on('error', (message) => {
            Object.values(this.web_clients).forEach(web_client => {
                web_client.error_node(node, message);
            });
        });

        socket.on('crash', (message) => {
            Object.values(this.web_clients).forEach(web_client => {
                web_client.error_node(node, message);
            });
            this.status = STATUS_READY;
        });
    }

    announce_web_client(socket) {
        const web_client = new WebClient(socket, this);
        this.web_clients[web_client.id] = web_client;
        Object.values(this.nodes).forEach(node => {
            web_client.add_node(node);
        });

        setInterval(() => {
            this.io.to('web_clients').emit('statusreport', { status: this.status });
        }, STATUS_INTERVAL / 10);

        socket.on('webreport', () => {
            if (this.status === STATUS_RUNNING) {
                socket.emit('webreport', this.runconfig.agent, this.runconfig.maxuser, stat.getTimeData(this), stat.getCountData());
            }
        });

        socket.on('detailreport', () => {
            if (this.status === STATUS_RUNNING) {
                socket.emit('detailreport', stat.getDetails());
            }
        });

        socket.on('disconnect', () => {
            delete this.web_clients[web_client.id];
        });
    }

    register() {
        this.io.on('connection', (socket) => {
            socket.on('announce_node', (message) => {
                this.log.info(`Registering new node ${JSON.stringify(message)}`);
                this.announce_node(socket, message);
            });

            socket.on('announce_web_client', () => {
                this.log.info("Registering new web_client");
                this.announce_web_client(socket);

                socket.on('run', (msg) => {
                    stat.clear();
                    msg.agent = Object.keys(this.nodes).length;
                    console.log('server begin notify client to run machine...');
                    this.runconfig = msg;
                    Object.values(this.nodes).forEach((ele, i) => {
                        msg.index = i;
                        ele.socket.emit('run', msg);
                    });
                    this.status = STATUS_RUNNING;
                });

                socket.on('ready', (msg) => {
                    console.log('server begin ready client ...');
                    this.io.to('nodes').emit('disconnect', {});
                    stat.clear();
                    this.status = STATUS_READY;
                    this.runconfig = msg;
                    starter.run(this.conf.mainFile, msg, this.conf.clients);
                });

                socket.on('exit4reready', () => {
                    Object.values(this.nodes).forEach(obj => {
                        obj.socket.emit('exit4reready');
                    });
                    this.nodes = {};
                });
            });
        });

        setInterval(() => {
            this.io.emit('heartbeat');
        }, HEARTBEAT_INTERVAL);
    }
}

exports.Server = Server;
