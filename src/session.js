import fs from 'fs';
import path from 'path';

const __authCredDir = path.relative(process.cwd(), 'sess_auth_info');

export const exists = () => {
	return fs.existsSync(__authCredDir)
		&& fs.statSync(__authCredDir).isDirectory()
		&& fs.readdirSync(__authCredDir).length > 0;
};

export const kill = () => {
	fs.rmSync(__authCredDir, { recursive: true, force: true });
	console.log('Connection closed. You are logged out.');
};
