import { jest } from "@jest/globals";
import request from "supertest";
import app, { errorHandler, logger } from "../server.js";

describe("Express app", () => {
  it("exports an Express application", () => {
    expect(app).toBeDefined();
    expect(typeof app).toBe("function");
  });

  // macOS lets a wildcard listener take a port another local app holds on 127.0.0.1, so requests reach that app.
  it("Test servers listen on the loopback address only", async () => {
    const server = app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    const { address } = server.address();
    await new Promise((resolve) => server.close(resolve));
    expect(address).toBe("127.0.0.1");
  });

  it("Unknown API paths return a JSON not found message", async () => {
    const response = await request(app).get("/vehicle-t6/no-such-route");
    expect(response.status).toBe(404);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(response.body).toEqual({ message: "Not found." });
  });

  it("Malformed JSON bodies return a JSON invalid JSON message", async () => {
    const response = await request(app)
      .post("/vehicle-t6/login")
      .set("Content-Type", "application/json")
      .send('{"bad json"');
    expect(response.status).toBe(400);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(response.body).toEqual({ message: "Invalid JSON." });
  });

  it("Unexpected errors return a generic server error without the stack", () => {
    const errorSpy = jest.spyOn(logger, "error");
    const res = { status: jest.fn().mockReturnThis(), send: jest.fn().mockReturnThis(), headersSent: false };
    const next = jest.fn();

    errorHandler(new Error("database exploded"), {}, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith({ message: "Server error." });
    expect(next).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("database exploded"));
    errorSpy.mockRestore();
  });

  it("Oversized request bodies keep their client error status", async () => {
    const response = await request(app)
      .post("/vehicle-t6/login")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ credential: "x".repeat(200 * 1024) }));

    expect(response.status).toBe(413);
    expect(response.body).toEqual({ message: "Invalid request." });
  });
});
