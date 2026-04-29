const { verifyDevice } = require('./auth');
const { onRemoveClothes } = require('./on_remove');
const {onDisconnect} = require('./disconnect');

module.exports = function (wss) {
	wss.on('connection', function connection(ws, req) {
		// ← req added
		const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
		let authenticated = false;
		let authTimeout;
		let deviceUuid = null;

		authTimeout = setTimeout(() => {
			if (!authenticated) {
				ws.close(1008, 'Authentication timeout');
			}
		}, 5000);

		ws.on('message', async function incoming(message) {
			// ← async added
			let data;
			try {
				data = JSON.parse(message);
			} catch (e) {
				ws.close(1003, 'Invalid JSON');
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
					console.warn(`[WS] Auth failed for UUID: ${uuid} | ip: ${ip}`);
					ws.close(1008, 'Unauthorized');
				} else {
					authenticated = true;
					deviceUuid = uuid;
					clearTimeout(authTimeout);
					console.log(`[WS] Device authenticated: ${uuid} | ip: ${ip}`);
					ws.send(JSON.stringify({ type: 'auth', success: true }));
				}
			} else if (!authenticated) {
				ws.close(1008, 'Not authenticated');
			} else if (data.type === 'status') {
				console.log(
					`Device sent message: ${deviceUuid}, content: ${data.value}`,
				);
				if (data.value === 'remove') {
					try {
						const result = await onRemoveClothes(deviceUuid);
						ws.send(
							JSON.stringify({
								type: 'remove_response',
								success: true,
								result: result,
							}),
						);
					} catch (error) {
						console.error('Error handling remove clothes:', error);
						ws.send(
							JSON.stringify({
								type: 'remove_response',
								success: false,
								error: error.message,
							}),
						);
					}
				} else {
					ws.send(JSON.stringify({ type: 'status', value: data.value, success: true }));
				}
			} else {
				console.log('[WS] Unhandled message type:', data);
			}
		});

		ws.on('close', async function (code) {
			clearTimeout(authTimeout);
			if (authenticated) {
        await onDisconnect(deviceUuid);
				console.log(`[WS] Device disconnected: ${deviceUuid} | code: ${code}`);
			}
		});
	});
};
