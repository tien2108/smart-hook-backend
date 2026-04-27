const { verifyDevice } = require('./auth');
const { handleRemoveClothes } = require('./on_remove');

module.exports = async function (wss) {
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
					console.log(`Device authenticated successfully: ${uuid}`);
				}
			} else if (data.type === 'message') {
				// Handle device message logic here
				console.log(`Device sent message: ${uuid}, content: ${data.content}`);
				if (data.content === 'remove') {
					try {
            const result = await handleRemoveClothes(uuid);
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

		ws.on('close', function () {
			console.log('WebSocket connection closed');
		});
	});
};
