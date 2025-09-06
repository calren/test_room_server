// A simple WebSocket server for a barebones MMORPG
// It will handle player connections, state, and movement.

const WebSocket = require('ws');
const fs = require('fs'); // <--- ADD THIS LINE

// Create a new WebSocket server on port 8080
const wss = new WebSocket.Server({ port: 8080 });

// This object will store the state of all players in the game world
const players = {};
const world = {
    width: 800,
    height: 600
};

// Define the file path for persistence
const PLAYERS_FILE = 'players.json'; // <--- ADD THIS LINE

// --- Persistence Functions ---
function saveState() {
    fs.writeFile(PLAYERS_FILE, JSON.stringify(players, null, 2), err => {
        if (err) {
            console.error('Failed to save game state:', err);
        } else {
            console.log('Game state saved.');
        }
    });
}

function loadState() {
    if (fs.existsSync(PLAYERS_FILE)) {
        try {
            const data = fs.readFileSync(PLAYERS_FILE);
            // Clear current players and load from file
            Object.assign(players, JSON.parse(data));
            console.log('Game state loaded from file.');
        } catch (error) {
            console.error('Failed to load game state:', error);
        }
    } else {
        console.log('No saved state found. Starting a new game.');
    }
}

// Call loadState() when the server starts
loadState(); // <--- ADD THIS LINE

console.log('MMORPG Server is running on ws://localhost:8080');

// This function sends a message to all connected clients
function broadcast(data) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

// Handle new connections to the server
wss.on('connection', ws => {
    // Generate a unique ID for the new player
    const playerId = Math.random().toString(36).substr(2, 9);
    console.log(`Player ${playerId} has connected.`);

    // Handle messages received from this client
    ws.on('message', message => {
        try {
            const data = JSON.parse(message);

            // Process different types of messages from the client
            switch (data.type) {
                // When a player joins the game
                case 'player_join':
                    // If player already exists (reconnecting), use their old data
                    if (!players[playerId]) {
                         players[playerId] = {
                            id: playerId,
                            username: data.username || 'Anonymous', // Use provided username or default
                            x: Math.floor(Math.random() * (world.width - 50)),
                            y: Math.floor(Math.random() * (world.height - 50)),
                            sprite: data.sprite || 'default', // Use a default sprite if none is provided
                        };
                        console.log(`Player ${data.username || 'Anonymous'} (${playerId}) joined the world at (${players[playerId].x}, ${players[playerId].y}).`);
                        // Save the state after a new player joins
                        saveState();
                    }
                    
                    // Send the current state of all players to the newly connected client
                    ws.send(JSON.stringify({ type: 'world_state', players }));
                    // Announce the new player to everyone else
                    broadcast({ type: 'player_joined', player: players[playerId] });
                    break;

                // When a player moves
                case 'player_move':
                    const player = players[playerId];
                    if (player) {
                        const speed = 10;
                        switch (data.direction) {
                            case 'up':
                                player.y = Math.max(0, player.y - speed);
                                break;
                            case 'down':
                                player.y = Math.min(world.height - 50, player.y + speed);
                                break;
                            case 'left':
                                player.x = Math.max(0, player.x - speed);
                                break;
                            case 'right':
                                player.x = Math.min(world.width - 50, player.x + speed);
                                break;
                        }
                        // Broadcast the player's new position to all clients
                        broadcast({ type: 'player_moved', player });
                    }
                    break;
            }
        } catch (error) {
            console.error('Failed to parse message or handle client action:', error);
        }
    });

    // Handle client disconnection
    ws.on('close', () => {
        console.log(`Player ${playerId} has disconnected.`);
        // Remove the player from the world
        delete players[playerId];
        // Announce the player's departure to all remaining clients
        broadcast({ type: 'player_left', playerId });
        saveState(); // <--- ADD THIS LINE
    });

    ws.on('error', (error) => {
        console.error(`WebSocket error for player ${playerId}:`, error);
    });
})
