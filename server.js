const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// Version
const VERSION = "2.0.1";

// In-memory storage
let commandQueue = [];
let completedCommands = [];
let commandIdCounter = 0;

// CORS- all origins
app.use(cors());

app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'okay',
    version: VERSION,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

// System status
app.get('/api/status', (req, res) => {
  res.json({
    version: VERSION,
    queueLength: commandQueue.length,
    completedCount: completedCommands.length,
    totalProcessed: commandIdCounter,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

// Add command to queue
app.post('/api/queue', (req, res) => {
  const { command, args, source, priority } = req.body;
  
  if (!command) {
    return res.status(400).json({ error: 'Command required' });
  }
  
  const id = ++commandIdCounter;
  const item = {
    id,
    command,
    args: args || {},
    source: source || 'unknown',
    priority: priority || 0,
    createdAt: new Date().toISOString(),
    status: "pending"
  };
  
  commandQueue.push(item);
  
  res.json({ success: true, id, queueSize: commandQueue.length });
});

// Get next command (bridge polls)
app.get('/api/queue/next', (req, res) => {
  if (commandQueue.length === 0) {
    return res.json({ empty: true });
  }
  
  // Sort by priority (highest first)
  commandQueue.sort((a, b) => b.priority - a.priority);
  
  const next = commandQueue.shift();
  next.status = "processing";
  next.startedAt = new Date().toISOString();
  
  res.json({ command: next });
});

// Complete command (bridge reports result)
app.post('/api/complete', (req, res) => {
  const { id, result, error } = req.body;
  
  if (!id) {
    return res.status(400).json({ error: 'Command ID required' });
  }
  
  const command = completedCommands.find(c => c.id === id);
  if (!command) {
    completedCommands.push({
      id,
      result,* // Bridge response
      error,
      completedAt: new Date().toISOString()
    });
  }
  
  res.json({ success: true });
});

// Get completed commands
app.get('/api/completed', (req, res) => {
  res.json({
    commands: completedCommands.slice(-100),
    count: completedCommands.length
  });
});

// Clear completed commands
app.post('/api/clear', (req, res) => {
  completedCommands = [];
  res.json({ success: true });
});

// Start server - bind to 0.0.0.0 for Render
app.listen(PORT, '0.0.0.0', () => {
  console.log(`TCC Sovereignty Backend v2.0.0 running on port ${PORT}`);
});
