const express = require('express');
const { MongoClient } = require('mongodb');
const app = express();
const port = process.env.PORT || 3000;

// MongoDB connection using environment variable
const uri =  process.env.MONGODB_URI; // Access from env
const client = new MongoClient(uri);

let leaderboardCollection;

async function connectToMongo() {
    try {
        await client.connect();
        console.log('Connected to MongoDB');
        const db = client.db('puzzleGame');
        leaderboardCollection = db.collection('leaderboard');
        // Ensure initial empty leaderboard if collection doesn't exist
        const count = await leaderboardCollection.countDocuments();
        if (count === 0) {
            await leaderboardCollection.insertOne({ leaderboard: [] });
        }
    } catch (error) {
        console.error('MongoDB connection error:', error);
        throw error; // Fail fast if connection fails
    }
}

// Rest of your server.js remains unchanged up to the listen block
app.use(express.static('public'));
app.use(express.json());

const icons = ["🟢", "🟥", "💙", "➕", "⭐"];

function createPuzzleGrid(size) {
    const shapes = icons.slice(0, size);
    let grid = Array(size).fill().map(() => Array(size).fill(''));
    for (let i = 0; i < size; i++) {
        let availableIcons = new Set(shapes);
        for (let j = 0; j < size; j++) {
            const availableCells = new Set(availableIcons);
            grid[i].forEach(icon => availableCells.delete(icon));
            grid.forEach(row => availableCells.delete(row[j]));
            if (availableCells.size === 0) return createPuzzleGrid(size);
            const shape = Array.from(availableCells)[Math.floor(Math.random() * availableCells.size)];
            grid[i][j] = shape;
            availableIcons.delete(shape);
        }
    }
    return { grid, shapes };
}

function removeIcons(grid) {
    const size = grid.length;
    const numIcons = size * size;
    const minRemovals = Math.floor(numIcons / 3);
    const maxRemovals = Math.floor(numIcons / 2);
    const numToRemove = Math.floor(Math.random() * (maxRemovals - minRemovals + 1)) + minRemovals;
    const allPositions = Array.from({ length: numIcons }, (_, i) => i);
    const removedPositions = allPositions.sort(() => 0.5 - Math.random()).slice(0, numToRemove);
    const questionMarkIndex = Math.floor(Math.random() * numToRemove);
    const questionMarkPos = removedPositions[questionMarkIndex];
    const ans = grid[Math.floor(questionMarkPos / size)][questionMarkPos % size];

    removedPositions.forEach((pos, index) => {
        const row = Math.floor(pos / size);
        const col = pos % size;
        grid[row][col] = (index === questionMarkIndex) ? "❔" : "‎";
    });

    return { grid, questionMarkPos, ans };
}

app.get('/new-game', (req, res) => {
    const size = parseInt(req.query.size) || 3;
    try {
        const { grid, shapes } = createPuzzleGrid(size);
        const { grid: puzzleGrid, questionMarkPos, ans } = removeIcons(grid.map(row => [...row]));
        console.log('New game generated:', { size, ans });
        res.json({ puzzleGrid, shapes, questionMarkPos, ans });
    } catch (error) {
        console.error('Error generating game:', error);
        res.status(500).json({ error: 'Failed to generate game' });
    }
});

app.post('/update-leaderboard', async (req, res) => {
    const { name, score } = req.body;
    if (!name || typeof score !== 'number') {
        console.error('Invalid leaderboard update:', req.body);
        return res.status(400).json({ success: false, error: 'Invalid name or score' });
    }
    try {
        const doc = await leaderboardCollection.findOne({});
        let leaderboard = doc.leaderboard || [];
        const existingEntry = leaderboard.find(entry => entry.name.toLowerCase() === name.toLowerCase());
        if (existingEntry) {
            if (score > existingEntry.score) {
                existingEntry.score = score;
                existingEntry.timestamp = Date.now();
                console.log(`Updated score for ${name}: ${score}`);
            }
        } else {
            leaderboard.push({ name, score, timestamp: Date.now() });
            console.log(`Added ${name} to leaderboard: ${score}`);
        }
        leaderboard.sort((a, b) => b.score - a.score || a.timestamp - b.timestamp);
        leaderboard = leaderboard.slice(0, 10);
        await leaderboardCollection.updateOne({}, { $set: { leaderboard } }, { upsert: true });
        console.log('Current leaderboard state:', JSON.stringify(leaderboard, null, 2));
        res.json({ success: true, leaderboard });
    } catch (error) {
        console.error('Error updating leaderboard:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

app.get('/leaderboard', async (req, res) => {
    try {
        const doc = await leaderboardCollection.findOne({});
        const leaderboard = doc.leaderboard || [];
        console.log('Leaderboard requested:', JSON.stringify(leaderboard, null, 2));
        res.json(leaderboard);
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// Start server and connect to MongoDB
app.listen(port, async () => {
    await connectToMongo();
    console.log(`Server running on port ${port}`);
});