const express = require("express");
const fs = require("fs");
const https = require("https");
const port = process.env.NODE_PORT || 8080;
const app = express();

const { SERVER_SSL_KEY, SERVER_SSL_CERT } = process.env;

app.disable("x-powered-by");

const actual = app => {
  if (SERVER_SSL_KEY && SERVER_SSL_CERT) {
    const options = {
      key: fs.readFileSync("./ssl/privatekey.pem"),
      cert: fs.readFileSync("./ssl/certificate.pem")
    };
    return https.createServer(options, app);
  } else {
    return app;
  }
};

app.get("/", function(req, res) {
  res.writeHead(200);
  res.end("hello\n");
});

const server = actual(app).listen(port, () => {
  console.log(`server started on port ${server.address().port}`);
});
