const { broadcast } = require('./websocket');
const fs = require('fs');
const path = require('path');

let interval;
let converters = [];
let globalState = {
    waveHeight: 2.5, // meters
    wavePeriod: 8.0, // seconds
    windSpeed: 15, // km/h
    islandDemand: 1.5, // MW
    batteryLevel: 65, // percentage
};

function randomWalk(val, min, max, maxDelta) {
    let delta = (Math.random() * 2 - 1) * maxDelta;
    let newVal = val + delta;
    return Math.max(min, Math.min(max, newVal));
}

function initData() {
    const dataPath = path.join(__dirname, '../data/converters.json');
    try {
        const fileData = fs.readFileSync(dataPath, 'utf8');
        converters = JSON.parse(fileData).map((c, index) => {
            // Force a mix of statuses initially by setting different stress levels
            let initialStress = 40; // GREEN
            if (index % 4 === 1) initialStress = 75; // YELLOW
            if (index % 4 === 2) initialStress = 88; // RED
            
            return {
                ...c,
                powerOutput: 0.3,
                hydraulicPressure: 150,
                rpm: 1200,
                stress: initialStress,
                damping: 50,
                ptoLimit: 1.0,
                mode: initialStress > 85 ? 'SAFE MODE' : 'AUTONOMOUS'
            };
        });
    } catch (e) {
        console.error("Failed to load converters.json", e);
    }
}

function tick() {
    globalState.waveHeight = randomWalk(globalState.waveHeight, 0.5, 8.0, 0.2);
    globalState.wavePeriod = randomWalk(globalState.wavePeriod, 4.0, 15.0, 0.5);
    globalState.windSpeed = randomWalk(globalState.windSpeed, 5, 100, 2);
    globalState.islandDemand = randomWalk(globalState.islandDemand, 0.8, 4.5, 0.1);

    let totalPower = 0;

    converters.forEach((c, index) => {
        if (c.mode === 'SAFE MODE') {
            c.powerOutput = 0.05;
            c.rpm = 200;
            c.stress = Math.max(85, c.stress + randomWalk(0, -1, 1, 0.5)); // Keep it in red zone for demo
            c.status = 'RED';
            c.damage = 'Hull corrosion detected. Safe mode active.';
        } else {
            let targetPower = Math.min(c.ptoLimit, (globalState.waveHeight * 0.15));
            c.powerOutput = randomWalk(c.powerOutput, 0, 2.5, 0.05);
            c.powerOutput += (targetPower - c.powerOutput) * 0.1; 

            c.rpm = c.powerOutput * 4000 + randomWalk(0, -50, 50, 10);
            c.hydraulicPressure = 100 + c.powerOutput * 100;
            
            // Add a permanent offset based on index so we maintain a mix of statuses
            let offset = 0;
            if (index % 4 === 1) offset = 35; // pushes into YELLOW
            if (index % 4 === 2) offset = 60; // pushes into RED

            let targetStress = ((globalState.waveHeight / 8.0) * 100) + offset;
            c.stress += (targetStress - c.stress) * 0.2 + randomWalk(0, -2, 2, 1);

            if (c.stress > 85) {
                c.status = 'RED';
                c.damage = 'Critical vibration levels. Inspect PTO.';
            }
            else if (c.stress > 65) {
                c.status = 'YELLOW';
                c.damage = 'Minor surface wear on hydraulic seals.';
            }
            else {
                c.status = 'GREEN';
                c.damage = 'None';
            }
            
            if (c.stress > 95) {
                c.mode = 'SAFE MODE';
                c.status = 'RED';
                c.damage = 'Emergency feathering engaged. Severe stress.';
            }
        }
        
        c.agents = {
            wave: c.status === 'RED' ? 'Predicting hazardous swell' : 'Tracking nominal waves',
            hydraulics: c.status === 'RED' ? 'Damping maxed (100%)' : `Damping tuned (${Math.floor(c.damping)}%)`,
            safety: c.status === 'RED' ? 'ALERT TRIGGERED' : 'Monitoring stress',
            weather: globalState.waveHeight > 5 ? 'Storm Warning' : 'Clear',
            grid: 'Balancing load'
        };
        
        totalPower += c.powerOutput;
    });

    const netPower = totalPower - globalState.islandDemand;
    globalState.batteryLevel = Math.max(0, Math.min(100, globalState.batteryLevel + netPower * 0.1));

    broadcast('telemetry', {
        timestamp: new Date().toISOString(),
        environment: globalState,
        converters: converters,
        summary: {
            totalPower,
            netPower,
            islandDemand: globalState.islandDemand,
            batteryLevel: globalState.batteryLevel
        }
    });
}

function start(wss) {
    initData();
    interval = setInterval(tick, 2000);
    console.log('Simulation engine started');
}

function stop() {
    if (interval) clearInterval(interval);
}

// Storm mode trigger for the API
function triggerStorm() {
    globalState.waveHeight = 6.5;
    globalState.windSpeed = 85;
}

module.exports = { start, stop, triggerStorm };
