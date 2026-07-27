import 'dotenv/config';
import { createApp } from './app.js';

const app = createApp();
const port = Number(process.env.PORT ?? 3001);

app.listen(port, '0.0.0.0', () => {
  console.log(`App Navi listening on http://0.0.0.0:${port}`);
});
