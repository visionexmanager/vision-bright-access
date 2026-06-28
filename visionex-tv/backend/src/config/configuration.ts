export default () => ({
  port: parseInt(process.env.PORT ?? "3000"),
  env:  process.env.NODE_ENV ?? "development",

  database: {
    host:     process.env.DB_HOST     ?? "localhost",
    port:     parseInt(process.env.DB_PORT ?? "5432"),
    name:     process.env.DB_NAME     ?? "visionex_tv",
    user:     process.env.DB_USER     ?? "postgres",
    password: process.env.DB_PASSWORD ?? "postgres",
    ssl:      process.env.DB_SSL === "true",
    poolMin:  parseInt(process.env.DB_POOL_MIN ?? "2"),
    poolMax:  parseInt(process.env.DB_POOL_MAX ?? "20"),
  },

  redis: {
    host:     process.env.REDIS_HOST     ?? "localhost",
    port:     parseInt(process.env.REDIS_PORT ?? "6379"),
    password: process.env.REDIS_PASSWORD ?? undefined,
    db:       parseInt(process.env.REDIS_DB ?? "0"),
  },

  jwt: {
    secret:           process.env.JWT_SECRET           ?? "change-me-in-production",
    accessExpiresIn:  process.env.JWT_ACCESS_EXPIRES   ?? "15m",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES  ?? "30d",
  },

  stream: {
    tokenTtlHours:   parseInt(process.env.STREAM_TOKEN_TTL_HOURS ?? "4"),
    healthIntervalMs: parseInt(process.env.STREAM_HEALTH_INTERVAL_MS ?? "30000"),
    maxRetries:      parseInt(process.env.STREAM_MAX_RETRIES ?? "3"),
    failoverTimeoutMs: parseInt(process.env.STREAM_FAILOVER_TIMEOUT_MS ?? "2000"),
    proxyUrl:        process.env.STREAM_PROXY_URL ?? "",
  },

  rateLimit: {
    ttl:   parseInt(process.env.RATE_LIMIT_TTL   ?? "60"),
    limit: parseInt(process.env.RATE_LIMIT_MAX   ?? "100"),
  },

  cors: {
    origin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  },
});
