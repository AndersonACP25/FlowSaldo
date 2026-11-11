import {readFileSync} from 'node:fs';
import {createServer as createHttpsServer} from 'node:https';
import express from 'express';
import {createAuth} from './controllers/auth';
import {renderError} from './views/errors';
import {records} from './controllers/records';
import {importRoutes} from './controllers/imports';
import { recurringRoutes } from './controllers/recurring';
import {financeRoutes} from './controllers/finance';
import {categoryRoutes} from './controllers/categories';
import { history } from './controllers/history';
import helmet from 'helmet';
import cors from 'cors';
import { z } from 'zod';
import { db } from '@flowsaldo/database';
const token = process.env.DEV_API_TOKEN;
if (!token || token.length < 24) throw new Error('Configura DEV_API_TOKEN con al menos 24 caracteres');
const certificatePath = process.env.TLS_CERT_FILE;
const privateKeyPath = process.env.TLS_KEY_FILE;
if (Boolean(certificatePath) !== Boolean(privateKeyPath)) {
 throw new Error('Configura TLS_CERT_FILE y TLS_KEY_FILE juntos.');
}
const tls = certificatePath && privateKeyPath
 ? {cert: readFileSync(certificatePath), key: readFileSync(privateKeyPath)}
 : null;
const host = process.env.HOST ?? '127.0.0.1';
if (process.env.TRUST_PROXY_LOOPBACK === '1' && (tls || !['127.0.0.1','::1'].includes(host))) {
 throw new Error('El modo proxy TLS requiere una API HTTP ligada a 127.0.0.1 o ::1.');
}
const app = express();
app.use(helmet());
if(process.env.TRUST_PROXY_LOOPBACK==='1')app.set('trust proxy','loopback');
const origins = (process.env.WEB_ORIGINS ?? 'http://localhost:8081,http://127.0.0.1:8081').split(',').map(s => s.trim());
app.use(cors({ origin: origins, methods: ['GET','POST','PATCH','DELETE','OPTIONS'], allowedHeaders: ['Authorization','Content-Type'] }));
app.use(express.json({ limit: '32kb' }));
app.get('/health', (_req, res) => res.json({ status: 'ok', mode: 'personal-development' }));
app.use((req,res,next)=>{if(process.env.NODE_ENV==='production'&&!req.secure){res.status(403).json({error:'Se requiere HTTPS para acceder a esta API.'});return;}next();});
const auth=createAuth(token);
app.use(auth.publicRoutes);
app.use(auth.authorize);
app.use(auth.sessionRoutes);
app.use(importRoutes);
app.use(history);
app.use(categoryRoutes);
app.use(recurringRoutes);
app.use(financeRoutes);
app.use(records);
app.use(renderError);
const port = z.coerce.number().int().min(1).max(65535).parse(process.env.PORT ?? 3000);
const listener = tls ? createHttpsServer(tls, app) : app;
const server = listener.listen(port, host, () => console.info('FlowSaldo API lista en puerto', port));
process.on('SIGTERM', () => server.close(() => { void db.$disconnect(); }));
