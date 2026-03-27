const {verifyDevice} = require('./auth');

module.exports = function(wss) {
  wss.on('connection', function connection(ws) {
    console.log('New WebSocket connection');

    ws.on('message', function incoming(message) {
      console.log('Received message:', message);
      let data;
      try {
        data = JSON.parse(message);
      } catch (e) {
        console.error('Invalid JSON:', e);
        return;
      }

      if (data.type === 'auth') {
        const { uuid } = data;
        if (!verifyDevice(uuid)) {
          ws.send(JSON.stringify({ type: 'auth', success: false, error: 'Invalid device UUID' }));
          console.warn(`Failed authentication attempt for device UUID: ${uuid}`);
          ws.close();
        } else {
          console.log(`Device authenticated successfully: ${uuid}`);
        }
      } else {
        // Handle other message types here
        console.log('Received non-auth message:', data);
      }
    });

    ws.on('close', function() {
      console.log('WebSocket connection closed');
    });
  });
}