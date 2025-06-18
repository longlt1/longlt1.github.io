const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const app = express();

app.use(cors());
app.use(express.json());

// Use a single global Pachi process
let pachiProcess = null;

function getPachiConfig(rank) {
    const configs = {
        'beginner': {
            max_games: 10,
            max_tree_size: 100,
            max_playouts: 100,
            time: 20,        // Maximum thinking time (seconds)
            quick: true,     // Quick mode
            // nopass: true,  // Disable pass
            // ladder: 1,     // Ladder handling level
            // komi: 6.5      // Komi for white
        },
        'intermediate': {
            max_games: 1000,
            max_tree_size: 10000,
            max_playouts: 10000,
            time: 10,        // Maximum thinking time (seconds)
            quick: false,    // Normal mode
            // nopass: true,  // Disable pass
            // ladder: 2,     // Ladder handling level
            // komi: 6.5      // Komi for white
        },
        'pro': {
            max_games: 10000,
            max_tree_size: 100000,
            max_playouts: 100000,
            time: 30,        // Maximum thinking time (seconds)
            quick: false,    // Normal mode
            // nopass: true,  // Disable pass
            // ladder: 3,     // Ladder handling level
            // komi: 6.5      // Komi for white
        }
    };
    return configs[rank] || configs['intermediate'];
}

function startPachi(rank = 'intermediate') {
    const config = getPachiConfig(rank);
    const cmd = [
        './pachi',
        '--gtp',
        `--max-games=${config.max_games}`,
        `--max-tree-size=${config.max_tree_size}`,
        `--max-playouts=${config.max_playouts}`,
        `--time=${config.time}`,
        config.quick ? '--quick' : null,
        // config.nopass ? '--nopass' : null,
        // `--ladder=${config.ladder}`,
        // `--komi=${config.komi}`,
    ].filter(Boolean);

    return spawn(cmd[0], cmd.slice(1), {
        stdio: ['pipe', 'pipe', 'pipe']
    });
}

function getOrCreatePachi(rank = 'intermediate') {
    if (!pachiProcess || pachiProcess.killed) {
        console.log(`(Re)starting global Pachi instance with rank ${rank}`);
        pachiProcess = startPachi(rank);
    }
    return pachiProcess;
}

function sendGtpCommand(cmd, rank = 'intermediate') {
    return new Promise((resolve, reject) => {
        const pachi = getOrCreatePachi(rank);
        
        try {
            pachi.stdin.write(cmd + '\n');
            
            let responseLines = [];
            let responseHandler = (data) => {
                const line = data.toString().trim();
                if (line.startsWith('=') || line.startsWith('?')) {
                    // GTP response found
                    // Remove the '=' or '?' and any leading space
                    const response = line.slice(1).trim();
                    responseLines.push(response);
                    pachi.stdout.removeListener('data', responseHandler);
                    resolve(responseLines.join('\n'));
                } else if (line !== '') {
                    responseLines.push(line);
                }
            };

            pachi.stdout.on('data', responseHandler);

            // Handle errors
            pachi.stderr.on('data', (data) => {
                console.error(`Pachi stderr: ${data}`);
            });

            pachi.on('error', (error) => {
                console.error(`Pachi process error: ${error}`);
                pachiProcess = null;
                reject(error);
            });

        } catch (error) {
            console.error(`Error sending command to Pachi: ${error}`);
            pachiProcess = null;
            reject(error);
        }
    });
}

async function sendMultipleCommands(commands, rank = 'intermediate') {
    const responses = {};
    for (const cmd of commands) {
        try {
            const response = await sendGtpCommand(cmd, rank);
            responses[cmd] = response;
        } catch (error) {
            console.error(`Error in command ${cmd}: ${error}`);
            responses[cmd] = `Error: ${error.message}`;
        }
    }
    return responses;
}

// API Routes
app.post('/batch', async (req, res) => {
    const commands = req.body.commands || [];
    const rank = req.body.rank || 'intermediate';
    
    if (!commands.length) {
        return res.status(400).json({ error: 'No commands provided' });
    }
    
    console.log(`Processing batch commands with rank ${rank}`);
    try {
        const responses = await sendMultipleCommands(commands, rank);
        res.json({ responses });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/genmove', async (req, res) => {
    const color = req.body.color || 'b';
    const rank = req.body.rank || 'intermediate';
    try {
        const response = await sendGtpCommand(`genmove ${color}`, rank);
        res.json({ response });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/play', async (req, res) => {
    const { color, vertex } = req.body;
    const rank = req.body.rank || 'intermediate';
    try {
        const response = await sendGtpCommand(`play ${color} ${vertex}`, rank);
        res.json({ response });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/boardsize', async (req, res) => {
    const size = req.body.size || 19;
    const rank = req.body.rank || 'intermediate';
    try {
        const response = await sendGtpCommand(`boardsize ${size}`, rank);
        res.json({ response });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/clear', async (req, res) => {
    const rank = req.body.rank || 'intermediate';
    try {
        const response = await sendGtpCommand('clear_board', rank);
        res.json({ response });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/quit', async (req, res) => {
    if (pachiProcess) {
        try {
            await sendGtpCommand('quit');
            pachiProcess = null;
        } catch (error) {
            console.error(`Error quitting Pachi: ${error}`);
        }
    }
    res.json({ status: 'Pachi quit' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Pachi API server running on port ${PORT}`);
}); 