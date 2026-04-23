import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";
import {
  easypaisaCheckoutPage,
  easypaisaFinalizeHandler,
  easypaisaIpnHandler,
  easypaisaPaths,
  easypaisaTokenHandler,
} from "./easypaisa";

const http = httpRouter();

// Register Better Auth routes
authComponent.registerRoutes(http, createAuth);
http.route({
  path: easypaisaPaths.checkout,
  method: "GET",
  handler: easypaisaCheckoutPage,
});
http.route({
  path: easypaisaPaths.token,
  method: "GET",
  handler: easypaisaTokenHandler,
});
http.route({
  path: easypaisaPaths.finalize,
  method: "GET",
  handler: easypaisaFinalizeHandler,
});
http.route({
  path: easypaisaPaths.finalize,
  method: "POST",
  handler: easypaisaFinalizeHandler,
});
http.route({
  path: easypaisaPaths.ipn,
  method: "GET",
  handler: easypaisaIpnHandler,
});

export default http;
