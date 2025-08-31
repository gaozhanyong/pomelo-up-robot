/**
 * stat: receive agent client monitor data,
 * merge valid data that has a response.
 * When the server restarts, it will be cleared.
 */

let _timeDataMap = {};
let _countDataMap = {};

const stat = {
    getTimeData: () => _timeDataMap,

    getCountData: () => _countDataMap,

    getDetails: () => {
        const detailTimeData = {};
        const detailCountData = {};

        Object.values(_timeDataMap).forEach(agentTimeData => {
            for (const action in agentTimeData) {
                if (!detailTimeData[action]) {
                    detailTimeData[action] = [];
                }
                detailTimeData[action].push(...agentTimeData[action]);
            }
        });

        Object.values(_countDataMap).forEach(agentCountData => {
            for (const action in agentCountData) {
                if (!detailCountData[action]) {
                    detailCountData[action] = 0;
                }
                detailCountData[action] += agentCountData[action];
            }
        });

        return { time: detailTimeData, count: detailCountData };
    },

    /**
     * clear data
     * @param {string} [agent] - Optional agent ID. If not provided, all data is cleared.
     */
    clear: (agent) => {
        if (agent) {
            delete _timeDataMap[agent];
            delete _countDataMap[agent];
        } else {
            _timeDataMap = {};
            _countDataMap = {};
        }
    },

    /**
     * Merge data from an agent.
     * @param {string} agent - The agent ID.
     * @param {object} message - The data message from the agent.
     */
    merge: (agent, message) => {
        if (message) {
            if (message.timeData) {
                _timeDataMap[agent] = message.timeData;
            }
            if (message.incrData) {
                _countDataMap[agent] = message.incrData;
            }
        }
    }
};

module.exports = stat;
