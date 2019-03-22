package com.example.demo;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import javax.net.ssl.*;
import java.io.IOException;
import java.util.Arrays;

@RestController
public class HelloWorldController {

    Logger logger = LoggerFactory.getLogger(HelloWorldController.class);

    @Value("${OTHER_SERVER_HOST:}")
    String serverHost;

    @Value("${OTHER_SERVER_PORT:}")
    Integer serverPort;

    @Autowired
    public HelloWorldController(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    private final RestTemplate restTemplate;

    @RequestMapping("/")
    public String hello() {
        return "hello";
    }

    @Scheduled(initialDelay = 10000, fixedDelay = 30000)
    public void sendServiceRequest() throws Exception {
        if (StringUtils.hasText(serverHost)) {
            String resourceUrl = "https://" + serverHost + ":" + serverPort;
            try {
                ResponseEntity<String> response = restTemplate.getForEntity(resourceUrl, String.class);
                if (response.getStatusCode().is2xxSuccessful()) {
                    logger.info("Successfully connected and validated with truststore.");
                } else {
                    handleCertProblem();
                }
            } catch (RestClientException e) {
                handleCertProblem();
            }
        }
    }

    private void handleCertProblem() throws Exception {
        try {
            SSLContext sc = SSLContext.getDefault();
            SSLSocketFactory factory = sc.getSocketFactory();
            SSLSocket socket = (SSLSocket) factory.createSocket(serverHost, serverPort);
            socket.startHandshake();
            SSLSession session = socket.getSession();
            Arrays.stream(session.getPeerCertificates()).forEach(certificate -> {
                try {
                    logger.info("-----BEGIN CERTIFICATE-----\n{}\n-----END CERTIFICATE-----", new sun.misc.BASE64Encoder().encode(certificate.getEncoded()));
                } catch (Exception e) {
                    logger.error("", e);
                }
            });

            socket.close();
        } catch (SSLHandshakeException e) {
            logger.error("", e);
        } catch (IOException e) {
            logger.error("", e);
        }
    }
}