const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Mock data paths
const convertersPath = path.join(__dirname, '../data/converters.json');

// Helper to read data
function readData(filePath) {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('Error reading data:', err);
        return [];
    }
}

// Routes
router.get('/converters', (req, res) => {
    const converters = readData(convertersPath);
    res.json(converters);
});

router.get('/converters/:id', (req, res) => {
    const converters = readData(convertersPath);
    const converter = converters.find(c => c.id === req.params.id);
    if (converter) {
        res.json(converter);
    } else {
        res.status(404).json({ error: 'Converter not found' });
    }
});

// Control endpoints
router.post('/control/safe-mode', (req, res) => {
    const { id, enable } = req.body;
    res.json({ success: true, message: `Safe mode ${enable ? 'enabled' : 'disabled'} for ${id}` });
});

router.post('/control/storm', (req, res) => {
    const SimulationEngine = require('./simulation');
    SimulationEngine.triggerStorm();
    res.json({ success: true, message: 'Storm scenario triggered' });
});

router.post('/control/hydraulic', (req, res) => {
    res.json({ success: true, message: 'Hydraulic control updated' });
});

module.exports = router;
