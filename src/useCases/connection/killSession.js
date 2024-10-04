import fs from 'fs'
import path from 'path'

export const killSession = () => {
  const __authCredDir = path.relative(process.cwd(), "sess_auth_info");
  console.log('Connection closed. You are logged out.')
  fs.rmSync(__authCredDir, { recursive: true, force: true });
}

