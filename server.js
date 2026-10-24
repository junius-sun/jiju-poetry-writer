import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { createConfigStore } from './server/ai/config.js';
import { createAiService } from './server/ai/service.js';
import { createPoetryServer } from './server/http.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const environmentFile = path.join(root, '.env.local');
if (existsSync(environmentFile)) process.loadEnvFile(environmentFile);
const configStore = createConfigStore(path.join(root, '.local', 'ai-config.json'));
const aiService = createAiService({ configStore });
const server = createPoetryServer({ root, configStore, aiService });
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
server.listen(port, host, () => console.log(`Server running on http://localhost:${port}`));
