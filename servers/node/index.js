const express = require("express");
const fs = require("fs");
const https = require("https");
const tls = require("tls");
const crypto = require("crypto");
const port = process.env.NODE_PORT || 8080;
const app = express();

const {
  SERVER_SSL_KEY,
  SERVER_SSL_CERT,
  OTHER_SERVER_HOST,
  OTHER_SERVER_PORT
} = process.env;

app.disable("x-powered-by");

const actual = app => {
  if (SERVER_SSL_KEY && SERVER_SSL_CERT) {
    const options = {
      key: SERVER_SSL_KEY,
      cert: SERVER_SSL_CERT
    };
    return https.createServer(options, app);
  } else {
    return app;
  }
};

app.get("/", function(req, res) {
  res.writeHead(200);
  console.log(`request came in from ${req.ip}`);
  res.end("hello\n");
});

const server = actual(app).listen(port, () => {
  console.log(`server started on port ${server.address().port}`);
});

// Just a silly fetch request to our "other" server to test to see if the CA Cert is working properly.
if (OTHER_SERVER_HOST) {
  const sha256 = s =>
    crypto
      .createHash("sha256")
      .update(s)
      .digest("base64");

  const certProcess = cert => {
    // console.info(`Server Name: ${tlsSocket.servername}`);
    console.info(`Subject: ${JSON.stringify(cert.subject)}`);
    console.info(`Issuer: ${JSON.stringify(cert.issuer)}`);
    // console.info(`Trusted: ${tlsSocket.authorized}`);
  };

  const options = {
    host: OTHER_SERVER_HOST,
    port: OTHER_SERVER_PORT ? OTHER_SERVER_PORT : 443,
    method: "GET",
    headers: {
      "User-Agent": "Node/https"
    },
    checkServerIdentity: () => {
      return null;
    },
    rejectUnauthorized: true
  };

  const fullRequest = options => {
    const socket = tls.connect(options, () => {
      console.log(
        "client connected, it is: ",
        socket.authorized ? "authorized" : "unauthorized"
      );
      certProcess(socket.getPeerCertificate());
      socket.end("", "utf8", () =>
        setTimeout(() => fullRequest(options), 30000)
      );
    });
    socket.on("error", e => {
      console.error(`${e.message} (code: ${e.code})`);
      setTimeout(() => fullRequest(options), 30000);
    });
  };

  setTimeout(() => fullRequest(options), 1000);
} else {
  console.log(`OTHER_SERVER_URI is not set, so doing nothing else.`);
}
