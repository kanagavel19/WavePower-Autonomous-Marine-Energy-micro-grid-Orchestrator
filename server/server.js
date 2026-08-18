const express = require('express');
const http = require('http');
const path = require('path');
const WebSocketSetup = require('./websocket');
const apiRoutes = require('./api');
const SimulationEngine = require('./simulation');

const app = express();
const server = http.createServer(app);

// Setup middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../')));

// Initialize WebSocket server
const wss = WebSocketSetup.init(server);

// Start Simulation Engine
SimulationEngine.start(wss);

// Use API routes
app.use('/api', apiRoutes);

// Redirect root to dashboard if logged in, or index (which might be login)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
