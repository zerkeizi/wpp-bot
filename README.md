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
├── public/
├── scripts/
├── package.json
├── jsconfig.json
├── pnpm-lock.yaml


! ISSUES da nova estrutura de pastas

1. Depois de logar da primeira vez, preciso encerrar o projeto e restartar pra então conseguir conectar de fato
2. Ele fica tentando sincronizar ainda
3. Não tá desconectando pela ação de desconectar dispositivo no zap