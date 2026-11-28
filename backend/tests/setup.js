import dotenv from "dotenv";
import net from "net";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env.test");
const examplePath = path.join(__dirname, "..", ".env.test.example");

dotenv.config({ path: envPath });
dotenv.config({ path: examplePath });

process.env.NODE_ENV = "test";

// supertest starts each server with listen(0), which binds every address. macOS allows that bind on a port
// another local app already holds on 127.0.0.1, and the request then reaches that app instead of ours
// (socket hang up, HTTP parse errors, stray 404s). Binding test servers to 127.0.0.1 makes the port ours alone.
// listen(port, host) cannot be used: it binds on a later tick, and supertest reads the port straight away.
// No public call binds to a host synchronously, so this uses _listen2, the private bind Node 24 and 26 call
// themselves. It is deprecated (DEP0208). If a Node upgrade removes it, the wrapper falls back to Node's own
// listen and "Test servers listen on the loopback address only" in app.test.js fails, so the gap is visible.
const LOOPBACK_PATCHED = Symbol.for("vehicle-t6.tests.loopbackListen");
if (!net.Server.prototype[LOOPBACK_PATCHED]) {
  const listen = net.Server.prototype.listen;
  net.Server.prototype.listen = function listenOnLoopback(...args) {
    const [port, second] = args;
    // Only a valid numeric port without a host changes (the shape supertest uses); anything else goes to Node untouched.
    const portOnly = Number.isInteger(port) && port >= 0 && port <= 65535 && typeof second !== "string";
    if (!portOnly || this._handle || typeof this._listen2 !== "function") return listen.apply(this, args);
    const callback = args.find((arg) => typeof arg === "function");
    if (callback) this.once("listening", callback);
    this._listen2("127.0.0.1", port, 4, typeof second === "number" ? second : undefined);
    return this;
  };
  // This file runs once per test file; the flag keeps the wrapper from stacking.
  net.Server.prototype[LOOPBACK_PATCHED] = true;
}
