const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const path = require('path');

// POST /api/mcp/install
router.post('/install', (req, res) => {
  const mcpServerDir = path.resolve(__dirname, '../../mcp-server');
  const installScript = path.join(mcpServerDir, 'install.js');

  console.log(`Executing MCP installation script: ${installScript}`);

  exec(`node ${installScript}`, { cwd: mcpServerDir }, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing install.js: ${error.message}`);
      return res.status(500).json({ error: `Script execution failed: ${stderr || error.message}` });
    }

    console.log(`install.js stdout: ${stdout}`);
    res.json({ message: `Installation script finished: ${stdout}` });
  });
});

module.exports = router;
