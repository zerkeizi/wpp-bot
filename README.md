### #0 - If it's the first time running the project

```bash
cp .env.default .env
```

and then generate required files:

```bash
pnpm generate
```

### #1 running

```bash
pnpm dev
```

# BASIC STRUCTURE
├── public/
├── src/
│   ├── routes.js
│   ├── server.js
│   ├── session.js
│   ├── socket.js
├── ├──client/
│   │  └── index.html
│   ├──zap/
│   │  └──commands/
│   │     └──connect.js
│		│	    └──listener.js
├── sess_auth_info/
├── package.json