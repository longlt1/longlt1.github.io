const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 3000;

// Global variable to hold the Pachi process
let pachiProcess = null;

// Ensure log directory exists
const logDir = path.join(__dirname, 'log');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

// Start Pachi process
function startPachi() {
    try {
        const pachi = spawn('../pachi/pachi', ['--gtp', '-t', '5']);
        
        // Set max listeners
        pachi.setMaxListeners(5);
        pachi.stdin.setMaxListeners(5);
        pachi.stdout.setMaxListeners(5);
        pachi.stderr.setMaxListeners(5);

        // Log process details
        console.log('[Pachi] Process started with PID:', pachi.pid);
        console.log('[Pachi] Process arguments:', pachi.spawnargs);

        // Handle process exit
        pachi.on('exit', (code, signal) => {
            console.log(`[Pachi] Process exited with code ${code} and signal ${signal}`);
            if (code !== 0) {
                console.log('[Pachi] Process exited abnormally');
            }
        });

        const logFile = fs.createWriteStream(path.join(logDir, 'pachi.log'), { flags: 'a' });
        pachi.stderr.pipe(logFile);
        console.log('[Pachi] Started with lowest difficulty settings');
        return pachi;
    } catch (error) {
        console.error('[Pachi] Failed to start process:', error);
        console.error('[Pachi] Error details:', {
            message: error.message,
            code: error.code,
            stack: error.stack
        });
        throw error;
    }
}

// Get or create Pachi process
function getOrCreatePachi() {
    if (!pachiProcess || pachiProcess.killed) {
        console.log('[Pachi] Creating new Pachi process');
        pachiProcess = startPachi();
    }
    return pachiProcess;
}

// Send GTP command to Pachi
function sendGtpCommand(cmd, retry = 3) {
    const pachi = getOrCreatePachi();
    // console.log(`[Pachi] Sending command: ${cmd}`);
    return new Promise((resolve, reject) => {
        try {
            // Check if process is still alive
            if (pachi.killed) {
                console.log('[Pachi] Process was killed, restarting...');
                pachiProcess = startPachi();
                if (retry > 0) {
                    return sendGtpCommand(cmd, retry - 1).then(resolve).catch(reject);
                }
                return reject(new Error('Pachi process was killed'));
            }

            // Remove any existing listeners
            pachi.removeAllListeners('error');
            pachi.stdin.removeAllListeners('error');
            pachi.stdout.removeAllListeners('data');

            // Handle process errors
            pachi.on('error', (err) => {
                console.error(`[Pachi] Process error:`, {
                    message: err.message,
                    code: err.code,
                    stack: err.stack
                });
                if (retry > 0) {
                    console.log(`[Pachi] Retrying command after error: ${cmd}`);
                    pachiProcess = startPachi();
                    sendGtpCommand(cmd, retry - 1).then(resolve).catch(reject);
                } else {
                    reject(err);
                }
            });

            // Handle EPIPE error
            pachi.stdin.on('error', (err) => {
                console.error(`[Pachi] stdin error:`, {
                    message: err.message,
                    code: err.code,
                    stack: err.stack
                });
                if (err.code === 'EPIPE') {
                    console.log('[Pachi] EPIPE error, restarting process...');
                    pachiProcess = startPachi();
                    if (retry > 0) {
                        sendGtpCommand(cmd, retry - 1).then(resolve).catch(reject);
                    } else {
                        reject(err);
                    }
                } else {
                    reject(err);
                }
            });

            pachi.stdin.write(cmd + '\n');
            let responseLines = [];
            let buffer = '';

            pachi.stdout.on('data', (data) => {
                buffer += data.toString();
                const lines = buffer.split('\n');
                buffer = lines.pop(); // Keep the last incomplete line in buffer

                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (trimmedLine.startsWith('=') || trimmedLine.startsWith('?')) {
                        // Remove '=' or '?' and any leading whitespace
                        const clean = trimmedLine.replace(/^([=?])\s*/, '');
                        responseLines.push(clean);
                        pachi.stdout.removeAllListeners('data');
                        const response = responseLines.join('\n');
                        console.log(`[Pachi] Response for ${cmd}: ${response}`);
                        resolve({ command: cmd, response: response });
                    } else if (trimmedLine !== '') {
                        responseLines.push(trimmedLine);
                    }
                }
            });
        } catch (error) {
            console.error(`[Pachi] Error sending command:`, {
                message: error.message,
                code: error.code,
                stack: error.stack
            });
            if (retry > 0) {
                console.log(`[Pachi] Retrying command: ${cmd}`);
                pachiProcess = startPachi();
                sendGtpCommand(cmd, retry - 1).then(resolve).catch(reject);
            } else {
                reject(error);
            }
        }
    });
}

// Middleware to parse JSON
app.use(express.json());

// Endpoint to execute a batch of GTP commands
app.post('/batch', async (req, res) => {
    const { commands } = req.body;
    if (!Array.isArray(commands)) {
        console.log('[Pachi] Invalid request: commands must be an array');
        return res.status(400).json({ error: 'Commands must be an array' });
    }
    console.log(`[Pachi] Processing batch of ${commands.length} commands`);
    // log commands
    console.log(`[Pachi] Commands: ${commands}`);
    try {
        const responses = {};
        // Process commands sequentially with small delay
        for (const cmd of commands) {
            try {
                const result = await sendGtpCommand(cmd);
                responses[cmd] = result.response;
                // Add small delay between commands
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                console.error(`[Pachi] Error processing command ${cmd}:`, error);
                responses[cmd] = `Error: ${error.message}`;
            }
        }
        // kill pachi process
        if (pachiProcess) {
            pachiProcess.kill();
            pachiProcess = null;
        }
        console.log('[Pachi] Batch processing completed successfully');
        res.json({ responses });
    } catch (error) {
        console.error(`[Pachi] Error processing batch: ${error}`);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Pachi API server running at http://localhost:${port}`);
}); 