const vm = require('vm');
const { EventEmitter } = require('events');
const monitor = require('../monitor/monitor');

class Actor extends EventEmitter {
    constructor(conf, aid) {
        super();
        this.id = aid;
        this.script = conf.script;

        this.on('start', (action, reqId) => {
            monitor.beginTime(action, this.id, reqId);
        });
        this.on('end', (action, reqId) => {
            monitor.endTime(action, this.id, reqId);
        });
        this.on('incr', (action) => {
            monitor.incr(action);
        });
        this.on('decr', (action) => {
            monitor.decr(action);
        });
    }

    run() {
        if (!this.script) {
            const err = new Error(`Actor ${this.id} run failed due to missing script.`);
            this.emit('error', err.stack);
            return;
        }
        try {
            const initSandbox = {
                console: console,
                require: require,
                actor: this,
                setTimeout: setTimeout,
                clearTimeout: clearTimeout,
                setInterval: setInterval,
                clearInterval: clearInterval,
                global: global,
                process: process
            };

            const context = vm.createContext(initSandbox);
            vm.runInContext(this.script, context);
        } catch (ex) {
            this.emit('error', ex.stack);
        }
    }

    /**
     * clear data
     */
    reset() {
        monitor.clear();
    }

    /**
     * wrap setTimeout
     *
     *@param {Function} fn
     *@param {Number} time
     */
    later(fn, time) {
        if (time > 0 && typeof (fn) === 'function') {
            return setTimeout(fn, time);
        }
    }

    /**
     * wrap setInterval
     * when time is Array, the interval time is the random number
     * between them
     *
     *@param {Function} fn
     *@param {Number|Array} timeConfig
     */
    interval(fn, timeConfig) {
        if (typeof fn !== 'function') {
            console.error('First argument to interval must be a function.');
            return;
        }

        if (typeof timeConfig === 'number' && timeConfig > 0) {
            return setInterval(fn, timeConfig);
        }

        if (Array.isArray(timeConfig) && timeConfig.length === 2) {
            const [start, end] = timeConfig;
            const randomTime = Math.round(Math.random() * (end - start) + start);

            return setTimeout(() => {
                fn();
                this.interval(fn, timeConfig); // Recursive call with original config
            }, randomTime);
        }
    }

    /**
     *wrap clearTimeout
     *
     * @param {Number} timerId
     *
     */
    clean(timerId) {
        clearTimeout(timerId);
    }
}

exports.Actor = Actor;
