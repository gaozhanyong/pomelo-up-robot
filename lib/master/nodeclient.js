class NodeClient {
    constructor(nodeId, socket, server) {
        this.nodeId = nodeId;
        this.socket = socket;
        this.iport = socket.handshake.headers.host;
        this.id = socket.id;
        this.log_server = server;

        // Join 'nodes' room
        socket.join('nodes');

        socket.on('disconnect', () => {
            // Notify all WebClients upon disconnect
            Object.values(this.log_server.web_clients).forEach(web_client => {
                web_client.remove_node(this);
            });
            socket.leave('nodes');
        });
    }
}

module.exports = {
    NodeClient: NodeClient
};
