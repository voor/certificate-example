const express = require("express");
const fs = require("fs");
const https = require("https");
const tls = require("tls");
const crypto = require("crypto");
const port = process.env.NODE_PORT || 8080;
const app = express();

const { SERVER_SSL_KEY, SERVER_SSL_CERT, OTHER_SERVER_URI } = process.env;

app.disable("x-powered-by");

const actual = app => {
  if (SERVER_SSL_KEY && SERVER_SSL_CERT) {
    const options = {
      key: fs.readFileSync(SERVER_SSL_KEY),
      cert: fs.readFileSync(SERVER_SSL_CERT)
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

// Just a silly fetch request to our "other" server to test to see if the CA Cert is working properly.
if (OTHER_SERVER_URI) {
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
    hostname: OTHER_SERVER_URI,
    port: 443,
    method: "GET",
    headers: {
      "User-Agent": "Node/https"
    },
    //disable session caching   (ノ°Д°）ノ︵ ┻━┻
    agent: new https.Agent({
      maxCachedSessions: 0
    }),
    checkServerIdentity: function(host, cert) {
      // Make sure the certificate is issued to the host we are connected to
      const err = tls.checkServerIdentity(host, cert);
      if (err) {
        return err;
      }

      do {
        console.log("Subject Common Name:", cert.subject.CN);
        console.log("  Certificate SHA256 fingerprint:", cert.fingerprint256);

        hash = crypto.createHash("sha256");
        console.log("  Public key ping-sha256:", sha256(cert.pubkey));

        lastprint256 = cert.fingerprint256;
        cert = cert.issuerCertificate;
      } while (cert.fingerprint256 !== lastprint256);
    }
  };

  const fullRequest = options => {
    let req = https.request(options, res => {
      console.log("statusCode:", res.statusCode);
      console.log("headers:", res.headers);

      res.on("data", d => {
        process.stdout.write(d);
      });
    });

    req.on("error", e => {
      if (e.code === "ECONNRESET") {
        /* I don't care about these */
      } else console.error(e);
    });

    req.on("socket", socket => {
      socket.on("secureConnect", () => {
        const cert = socket.getPeerCertificate();
        certProcess(cert);
        setTimeout(() => fullRequest(options), 30000);
        return req.abort();
      });
    });
  };

  setTimeout(() => fullRequest(options), 1000);
}
