/**
 * agent monitor data map
 * every agent put start and end time into a route map
 * then reports to the master
 */

let dataMap = {};
let incrMap = {};
let profData = {};

const monitor = {
    getData: () => ({
        timeData: profData,
        incrData: incrMap
    }),

    clear: () => {
        profData = {};
        incrMap = {};
        dataMap = {};
    },

    incr: (name) => {
        incrMap[name] = (incrMap[name] || 0) + 1;
    },

    decr: (name) => {
        if (incrMap[name]) {
            incrMap[name]--;
        }
    },

    beginTime: (route, uid, id) => {
        const time = Date.now();
        if (!dataMap[route]) {
            dataMap[route] = {};
        }
        if (!dataMap[route][uid]) {
            dataMap[route][uid] = {};
        }
        dataMap[route][uid][id] = time;
    },

    endTime: (route, uid, id) => {
        const beginTime = dataMap[route]?.[uid]?.[id];
        if (!beginTime) {
            return;
        }

        delete dataMap[route][uid][id];
        const span = Date.now() - beginTime;

        const srcData = profData[route];
        if (!srcData) {
            profData[route] = { min: span, max: span, avg: span, num: 1 };
        } else {
            if (span < srcData.min) {
                srcData.min = span;
            }
            if (span > srcData.max) {
                srcData.max = span;
            }
            srcData.avg = (srcData.avg * srcData.num + span) / (srcData.num + 1);
            srcData.num += 1;
        }
    }
};

module.exports = monitor;
