import { Application, Router } from "https://deno.land/x/oak/mod.ts";
import { basicAuth } from "./lib/auth.ts";
import {
  handleStability, handleChatGPT,
  handleLoad, handleLoadVersion, handleLoadVersions,
  handleLoadResult, handlePersist, handlePersistResult, handleListApps,
  handleListUsers, handleBulkCreateUsers
} from './routes/api.ts';
import { handleUserFacingURLs, handleStaticFiles } from './routes/user-facing-and-static.ts';
import { renderResult } from "./routes/result-renderer.ts";
import { serveThumbnail } from "./routes/thumbnail.ts";


const router = new Router();

// JSON Endpoints
router
  .post('/stability', handleStability)
  .post('/chatgpt', handleChatGPT)
  .post('/persist-result', handlePersistResult)
  .post('/persist', handlePersist)
  .post('/list-apps', handleListApps)
  .post('/load-versions', handleLoadVersions)
  .post('/load-version', handleLoadVersion)
  .post('/load-result', handleLoadResult)
  .post('/load', handleLoad)
  ;


// User Facing URLs
router
  .get('/app', handleUserFacingURLs)
  .get('/app/:id', handleUserFacingURLs)
  .get('/apps', handleUserFacingURLs)
  .get('/apps/:user', handleUserFacingURLs)
  .get("/result/:id", renderResult)
  .get("/thumbnail/:id", serveThumbnail)
  .get('/admin', handleUserFacingURLs)
  .get('/', handleUserFacingURLs)
  ;

// Admin Endpoints
router
  .get('/list-users', handleListUsers)
  .post('/bulk-create-users', handleBulkCreateUsers);

const app = new Application();

// Authentication Middleware

const routePrefixes = [
  "/app", "/apps",
];

const exactRoutes = [
  '/',
  '/stability', '/chatgpt',
  '/persist', '/persist-result',
  '/load', '/load-version', '/load-versions', '/load-result',
  "/app", "/apps", "/list-apps",
  "/admin",
  "/list-users", "/bulk-create-users",
];

app.use(async (ctx, next) => {

  const path = ctx.request.url.pathname;

  const isAuthRoute =
    routePrefixes.some(prefix => path.startsWith(prefix + "/"))
    || exactRoutes.some(route => path === route);

  if (isAuthRoute) {

    const authResult = await basicAuth(ctx.request);

    if (!authResult.isAuthenticated || !authResult.username) {
      ctx.response.status = 401;
      ctx.response.body = 'Unauthorized';
      ctx.response.headers.set('WWW-Authenticate', 'Basic realm="Esquisse"');
      return;
    }
    ctx.state.user = authResult; // { isAuthenticated,  isAdmin, username}
  }
  await next();
});


app.use(router.routes());
app.use(router.allowedMethods());


// Fallback Middleware for Static Files
app.use(async (ctx, next) => {
  const path = ctx.request.url.pathname;

  const isRoutePath =
    routePrefixes.some(prefix => path.startsWith(prefix + "/"))
    || exactRoutes.some(route => path === route);

  if (!isRoutePath) {
    await handleStaticFiles(ctx);
  } else {
    await next();
  }
});


app.addEventListener("error", (evt) => {
  console.error(evt.error);
});

const port = Deno.env.get("PORT") ? parseInt(Deno.env.get("PORT")) : 8000;

console.log(`HTTP webserver running. Access it at: http://localhost:${port}/`);

await app.listen({ port });


