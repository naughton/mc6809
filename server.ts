// Copyright © 2014-2022 - Patrick Naughton

import express from "express";
import { createServer } from "http";
import { join } from "path";

const app = express();
app.use(express.json());
app.use(express.static("express"));
app.use("/", (req, res) => {
  const path = join(__dirname, req.path === "/" ? "index.html" : req.path);
  res.sendFile(path);
});
const server = createServer(app);
const port = 3000;
server.listen(port);
console.debug("Server listening on port " + port);
