import { io } from 'socket.io-client';

const socket = io('http://localhost:5174', { transports: ['websocket'] });

socket.on('connect', () => {
	console.log('connected', socket.id);
	socket.emit(
		'session.status',
		{ key: process.env.TERMINAL_KEY || 'testkey12345', sessionId: 'claude_test' },
		(res) => {
			console.log('session.status response:', res);
			socket.close();
			process.exit(0);
		}
	);
});

socket.on('connect_error', (err) => {
	console.error('connect_error', err);
	process.exit(1);
});

socket.on('error', (err) => {
	console.error('socket error', err);
});
