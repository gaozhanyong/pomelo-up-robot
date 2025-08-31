const cp = require('child_process');
const fs = require('fs');
const vm = require('vm');
const util = require('util');
const exec = util.promisify(cp.exec);

// Stylize a string
function stylize(str, style) {
    const styles = {
        'bold': [1, 22],
        'italic': [3, 23],
        'underline': [4, 24],
        'cyan': [96, 39],
        'blue': [34, 39],
        'yellow': [33, 39],
        'green': [32, 39],
        'red': [31, 39],
        'grey': [90, 39],
        'green-hi': [92, 32],
    };
    return '\033[' + styles[style][0] + 'm' + str +
        '\033[' + styles[style][1] + 'm';
}

function $(str) {
    str = new String(str);
    ['bold', 'grey', 'yellow', 'red', 'green', 'cyan', 'blue', 'italic', 'underline'].forEach(style => {
        Object.defineProperty(str, style, {
            get: function () {
                return $(stylize(this, style));
            }
        });
    });
    return str;
}

const log = (...args) => {
    console.log(args.join(' '));
};

class Starter {

    async run(main, message, clients) {
        const effectiveClients = clients || ['127.0.0.1'];
        await this.prepare(main, message, effectiveClients);
    }

    async prepare(main, message, clients) {
        const count = parseInt(message.agent, 10) || 1;
        const promises = [];
        const cmd = `cd ${process.cwd()} && ${process.execPath} ${main} client > log/.log`;

        for (const ip of clients) {
            for (let i = 0; i < count; i++) {
                const promise = (ip === '127.0.0.1')
                    ? this.localrun(cmd)
                    : this.sshrun(cmd, ip);
                promises.push(promise);
            }
        }

        try {
            await Promise.all(promises);
            log('All agents have been started successfully.');
        } catch (error) {
            this.abort('Some agents failed to start.');
        }
    }

    async sshrun(cmd, host) {
        const sshCmd = `ssh ${host} "${cmd.replace(/"/g, '\\"')}"`;
        log(`Executing ${$(cmd).yellow} on ${$(host).blue}`);
        try {
            const { stdout, stderr } = await exec(sshCmd);
            if (stderr) log(`Stderr from ${host}: ${stderr}`);
            if (stdout) log(`Stdout from ${host}: ${stdout}`);
        } catch (error) {
            this.abort(`FAILED TO RUN on ${host}: ${error.message}`);
            throw error;
        }
    }

    async localrun(cmd) {
        log(`Executing ${$(cmd).green} locally`);
        try {
            const { stdout, stderr } = await exec(cmd);
            if (stderr) log(`Stderr: ${stderr}`);
            if (stdout) log(`Stdout: ${stdout}`);
        } catch (error) {
            this.abort(`FAILED TO RUN locally: ${error.message}`);
            throw error;
        }
    }

    set(key, def) {
        const getter = (typeof def === 'function') ? def : () => def;
        Object.defineProperty(this, key, {
            get: getter,
            configurable: true,
            enumerable: true
        });
    }

    load(file) {
        if (!file) throw new Error('File not specified');
        log('Executing compile ' + file);
        const code = coffee.compile(fs.readFileSync(file).toString());
        const script = vm.createScript(code, file);
        script.runInNewContext(this);
    }

    abort(msg) {
        log($(msg).red);
    }
}

module.exports = new Starter();
