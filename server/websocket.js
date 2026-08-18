const WebSocket = require('ws');

let wss;

function init(server) {
    wss = new WebSocket.Server({ server });

    wss.on('connection', (ws) => {
        console.log('Client connected to WebSocket');
        
        ws.send(JSON.stringify({ type: 'connection_status', data: 'CONNECTED' }));

        ws.on('close', () => {
            console.log('Client disconnected');
        });
        
        ws.on('error', console.error);
    });

    return wss;
}

function broadcast(type, data) {
    if (!wss) return;
    const payload = JSON.stringify({ type, data });
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
        }
    });
}

module.exports = { init, broadcast };
