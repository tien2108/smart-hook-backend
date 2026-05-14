const WebSocket = require('ws');

// const URL = 'wss://smart-hook-backend.onrender.com/';
const URL = 'ws://localhost:3000/'; // for local testing, replace with actual URL if different
const TEST_UUID = 'abc'; // replace this

const ws = new WebSocket(URL);

ws.on('open', () => {
	console.log('Connected to server');

	// Send auth message
	ws.send(JSON.stringify({ type: 'auth', uuid: TEST_UUID }));
	console.log('Sent auth with UUID:', TEST_UUID);
});

ws.on('message', (data) => {
	const msg = JSON.parse(data);
	console.log('Received:', JSON.stringify(msg, null, 2));

	if (msg.type === 'auth' && msg.success) {
		console.log('Authenticated! Sending test message...');
		ws.send(JSON.stringify({ type: 'status', value: 'remove' }));
	}
});

ws.on('close', (code, reason) => {
	console.log(
		`Connection closed | code: ${code} | reason: ${reason.toString()}`,
	);
});

ws.on('error', (err) => {
	console.error('WebSocket error:', err.message);
});
