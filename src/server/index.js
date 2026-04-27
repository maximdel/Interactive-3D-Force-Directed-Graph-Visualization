require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, '../../public')));
app.use('/client', express.static(path.join(__dirname, '../client')));

app.get('/api/graph', (req, res) => {
  res.json({
    nodes: [
      { id: 'a', label: 'Node A' },
      { id: 'b', label: 'Node B' },
      { id: 'c', label: 'Node C' },
      { id: 'd', label: 'Node D' },
      { id: 'e', label: 'Node E' },
    ],
    links: [
      { source: 'a', target: 'b' },
      { source: 'a', target: 'c' },
      { source: 'b', target: 'd' },
      { source: 'c', target: 'd' },
      { source: 'd', target: 'e' },
    ],
  });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
