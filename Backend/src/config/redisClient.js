import { createClient } from 'redis';
import dotenv from 'dotenv';
dotenv.config();

const redisClient = createClient({
  username: process.env.REDIS_USERNAME,
  password: process.env.REDIS_PASSWORD,
  socket: {
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
  },
});

redisClient.on('error', (err) => console.log('❌ Redis Client Error:', err));

redisClient.connect()
  .then(() => console.log('✅ Redis Connected'))
  .catch((err) => console.log('⚠️ Redis Connection Failed:', err.message));

export default redisClient;
