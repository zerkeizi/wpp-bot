// @ts-nocheck
import fs from 'fs';
import path from 'path';
import { updateClient } from './socket.js';

const __authCredDir = path.relative(process.cwd(), 'sess_auth_info');

export const existSession = () => fs.existsSync(__authCredDir);

export const killWPSession = () => {
	fs.rmSync(__authCredDir, { recursive: true, force: true });
	console.log('Connection closed. You are logged out.');
};

export { updateClient }; // for use in other modules
