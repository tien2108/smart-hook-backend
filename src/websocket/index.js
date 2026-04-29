const { verifyDevice } = require('./auth');
const { onRemoveClothes } = require('./on_remove');

module.exports = async function (wss) {
	wss.on('connection', function connection(ws) {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    let authenticated = false;
    let authTimeout;
    let deviceUuid = null;

    // Kick unauthenticated connections after 5 seconds
    authTimeout = setTimeout(() => {
      if (!authenticated) {
        ws.close(1008, 'Authentication timeout');
      }
    }, 5000);

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
					ws.send(
						JSON.stringify({
							type: 'auth',
							success: false,
							error: 'Invalid device UUID',
						}),
					);
					console.warn(
						`Failed authentication attempt for device UUID: ${uuid}`,
					);
					ws.close();
				} else {
          authenticated = true;
          deviceUuid = uuid;
          clearTimeout(authTimeout);
          console.log(`[WS] Device authenticated: ${uuid} | ip: ${ip}`);
          ws.send(JSON.stringify({ type: 'auth', success: true }));
				}
			}
      else if (!authenticated) {
        ws.close(1008, 'Not authenticated');
      } 
      else if (data.type === 'message') {
				// Handle device message logic here
				console.log(`Device sent message: ${deviceUuid}, content: ${data.content}`);
				if (data.content === 'remove') {
					try {
            const result = await onRemoveClothes(deviceUuid);
            ws.send(JSON.stringify({ type: 'remove_response', success: true, result: result }));
          } catch (error) {
            console.error('Error handling remove clothes:', error);
            ws.send(JSON.stringify({ type: 'remove_response', success: false, error: error.message }));
          }
				}
				ws.send(JSON.stringify({ type: 'message', success: true }));
			} else {
				// Handle other message types here
				console.log('Received non-auth message:', data);
			}
		});

		ws.on('close', function (code, reason) {
      clearTimeout(authTimeout);
      if (authenticated) {
        console.log(`[WS] Device disconnected: ${deviceUuid} | code: ${code}`);
      }
		});
	});
};
