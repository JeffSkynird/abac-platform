const express = require("express");
const app = express();

app.get("/public/health", (_req, res) => {
  res.json({ ok: true, route: "public/health" });
});

app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "Hello from protected route (requires ALLOW)",
    forwarded: {
      method: req.headers["x-forwarded-method"],
      path: req.headers["x-forwarded-path"],
      host: req.headers["x-forwarded-host"],
    },
  });
});

app.listen(3000, () => console.log("Example app on :3000"));
