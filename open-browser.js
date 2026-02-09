import { open } from 'open';

// Wait for backend to start
await new Promise(resolve => setTimeout(resolve, 2000));

// Open browser to localhost:3001
open('http://localhost:3001').catch(err => {
  console.log('Could not open browser automatically:', err.message);
  console.log('Open http://localhost:3001 manually in your browser');
});
