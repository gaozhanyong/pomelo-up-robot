const http = require('http');
const fs = require('fs');
const path = require('path');
const { qputs, inherits } = require('../common/util');
const { EventEmitter } = require('events');
const stat = require('../monitor/stat');

/**
 * Processes raw statistics data and formats it for reporting.
 * @param {object} pdata - The raw data from stat.getData().
 * @returns {string} A JSON string representing the formatted report data.
 */
function formatReportData(pdata) {
    const mdata = [];

    // pdata is { time: timeData, count: countData }
    const timeData = pdata.time || {};

    Object.entries(timeData).forEach(([agentId, agentData]) => {
        const single = { name: agentId, uid: agentId };
        const keycolumns = Object.keys(agentData).filter(action => agentData[action].length > 0);
        if (keycolumns.length === 0) return;

        const gcolumns = ['users', ...keycolumns];
        const grows = [];
        const gsummary = {};

        const maxRows = Math.max(...keycolumns.map(key => agentData[key].length));

        for (let i = 0; i < maxRows; i++) {
            const row = [i + 1];
            keycolumns.forEach(key => {
                row.push(agentData[key][i] || 0);
            });
            grows.push(row);
        }

        keycolumns.forEach(key => {
            const kdata = agentData[key];
            if (!kdata || kdata.length === 0) {
                gsummary[key] = { max: 0, min: 0, avg: 0, qs: 0 };
                return;
            }
            const sum = kdata.reduce((acc, val) => acc + val, 0);
            const avg = Math.round(sum / kdata.length);
            gsummary[key] = {
                max: Math.max(...kdata),
                min: Math.min(...kdata),
                avg: avg,
                qs: avg > 0 ? Math.round(kdata.length * 1000 / avg) : 0
            };
        });

        single.summary = gsummary;
        single.charts = { "latency": { "name": "robot", "uid": single.uid, "columns": gcolumns, "rows": grows } };
        if (grows.length > 0) {
            mdata.push(single);
        }
    });

    return JSON.stringify(mdata);
}

class HttpServer extends EventEmitter {
    constructor() {
        super();
        this.routes = [];
        this.running = false;
        this.server = null;
        this.hostname = 'localhost';
        this.port = 8000;
        this.connections = [];
    }

    start(port, hostname) {
        if (this.running) return this;
        this.running = true;

        this.hostname = hostname || 'localhost';
        this.port = port || 8000;

        this.server = http.createServer((req, res) => this.route(req, res));
        this.server.on('connection', (c) => {
            c.on('close', () => {
                const idx = this.connections.indexOf(c);
                if (idx !== -1) this.connections.splice(idx, 1);
            });
            this.connections.push(c);
        });
        this.server.listen(this.port, this.hostname);
        this.emit('start', this.hostname, this.port);
        return this;
    }

    stop() {
        if (!this.running) return;
        this.running = false;
        this.connections.forEach(c => c.destroy());
        this.server.close();
        this.server = null;
        this.emit('end');
    }

    addRoute(regex, handler) {
        this.routes.unshift({ regex, handler });
        return this;
    }

    removeRoute(regex, handler) {
        this.routes = this.routes.filter(r => !((regex === r.regex) && (!handler || handler === r.handler)));
        return this;
    }

    route(req, res) {
        for (const route of this.routes) {
            if (req.url.match(route.regex)) {
                route.handler(req.url, req, res);
                return;
            }
        }

        if (req.method === 'GET') {
            this.serveFile(req.url, res);
        } else {
            res.writeHead(405, { "Content-Length": "0" });
            res.end();
        }
    }

    serveFile(url, response) {
        if (url.includes('report')) {
            const reportData = formatReportData(stat.getDetails());
            response.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(reportData) });
            response.write(reportData);
            response.end();
            return;
        }

        const file = path.join(__dirname, (url === '/' || url === '/index.html') ? 'index.html' : url);

        fs.stat(file, (err, stat) => {
            if (err) {
                response.writeHead(404, { "Content-Type": "text/plain" });
                response.write(`Cannot find file: ${file}`);
                response.end();
                return;
            }

            fs.readFile(file, "binary", (err, data) => {
                if (err) {
                    response.writeHead(500, { "Content-Type": "text/plain" });
                    response.write(`Error opening file ${file}: ${err}`);
                } else {
                    const contentType = file.endsWith('.html') ? "text/html; charset=utf-8" : "application/octet-stream";
                    response.writeHead(200, { 'Content-Length': data.length, 'Content-Type': contentType });
                    response.write(data, "binary");
                }
                response.end();
            });
        });
    }
}

const HTTP_SERVER = new HttpServer();
HTTP_SERVER.on('start', (hostname, port) => {
    qputs(`Started HTTP server on ${hostname}:${port}.`);
});
HTTP_SERVER.on('end', () => {
    qputs('Shutdown HTTP server.');
});

exports.HttpServer = HttpServer;
exports.HTTP_SERVER = HTTP_SERVER;
