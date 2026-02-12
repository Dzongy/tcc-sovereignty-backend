const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// Version
const VERSION = "2.0.0";

// In-memory storage
let commandQueue = [];
let completedCommands = [];
let commandIdCounter = 0;

// CORS - all origins
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

// Complete command (bridge reeports back)
app.post('/api/queue/:id/complete', (req, res) => {
  const id = parseInt(req.params.id);
  const { result, error } = req.body;
  
  const index = commandQueue.findIndex(c => c.id === id && c.status === "processing");
  
  if (index === -1) {
    return res.status(404).json({ error: 'Command not found or already completed' });
  }
  
  const completed = commandQueue.splice(index, 1)[0];
  completed.status = error ? "failed" : "completed";
  completed.result = result || null;
  completed.error = error || null;
  completed.completedAt = new Date().toISOString();
  
  completedCommands.push(completed);
  
  // Keep only last 100 completed commands
  if (completedCommands.length > 100) {
    completedCommands = completedCommands.slice(-100);
  }
  
  res.json({ success: true, id });
});

// Error handling
middleware(app.get('*'), (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`TCC Sovereignty Backend v2.0 running on port ${PORT}`);
});