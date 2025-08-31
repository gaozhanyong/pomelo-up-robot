# pomelo-up-robot

A fully modernized pomelo-robot, upgraded with ES6+ and latest dependencies. This tool is designed for benchmarking `socket.io` servers with support for distributed execution and custom scripts.

It executes developer-defined JavaScript in a sandboxed environment, performs statistical analysis (including response time and QPS), and reports data to a web-based dashboard with graphical displays.

## Core Upgrades

This version introduces a comprehensive modernization of the original `pomelo-robot`:

*   **Upgraded Dependencies**: `socket.io` and `socket.io-client` have been updated to v4.x for improved performance and security.
*   **Modern JavaScript (ES6+)**: The entire codebase has been refactored from legacy JavaScript to use modern ES6+ syntax, including `class`, `const`/`let`, arrow functions, and `async/await`.
*   **Removed Underscore.js**: The dependency on `underscore.js` has been completely removed in favor of native JavaScript functions.
*   **Code Standardization**: Integrated `standard` for consistent code style and quality, with linting scripts available.

## Installation

```
npm install pomelo-up-robot
```

## Usage

```javascript
const envConfig = require('./app/config/env.json');
const config = require('./app/config/' + envConfig.env + '/config');
const { Robot } = require('pomelo-up-robot');

const robot = new Robot(config);
let mode = 'master';

if (process.argv.length > 2) {
    mode = process.argv[2];
}

if (mode !== 'master' && mode !== 'client') {
    throw new Error('mode must be master or client');
}

if (mode === 'master') {
    robot.runMaster(__filename);
} else {
    const script = (process.cwd() + envConfig.script);
    robot.runAgent(script);
}
```

## API

### robot.runMaster()

Run master server and an HTTP web console, then initialize server status and prepare to start agents.

#### Arguments

*   `startupFile` - The master server auto startup agent file name, default is current running file;

### robot.runAgent()

Run the robot in client agent mode.

#### Arguments

*   `script` - The developer's custom script that the agent will execute.

### Notice

When pomelo-robot runs in distributed mode, every client should be in the same directory path, and the master must be able to SSH into them without a password. Alternatively, you can start each agent manually. For custom script examples, refer to [the demo](https://github.com/NetEase/pomelo-robot-demo).
