import "reflect-metadata";
import { NestFactory }               from "@nestjs/core";
import { ValidationPipe }            from "@nestjs/common";
import { ConfigService }             from "@nestjs/config";
import { AppModule }                 from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log"],
    bodyParser: true,
  });

  const cfg  = app.get(ConfigService);
  const port = cfg.get<number>("port", 3000);
  const cors = cfg.get<string>("cors.origin", "*");

  // Input validation — strip unknown keys, throw on bad data
  app.useGlobalPipes(new ValidationPipe({
    whitelist:            true,
    forbidNonWhitelisted: true,
    transform:            true,
    transformOptions:     { enableImplicitConversion: true },
  }));

  // CORS
  app.enableCors({
    origin:         cors,
    methods:        ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    credentials:    true,
  });

  // Trust proxy (for real IP behind Nginx / K8s ingress)
  const httpAdapter = app.getHttpAdapter().getInstance();
  httpAdapter.set("trust proxy", 1);

  // Graceful shutdown
  app.enableShutdownHooks();

  await app.listen(port, "0.0.0.0");
  console.log(`[bootstrap] Visionex TV backend listening on :${port}`);
}

bootstrap().catch(console.error);
