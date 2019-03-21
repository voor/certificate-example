package com.example.demo;

import java.util.concurrent.atomic.AtomicLong;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;
import sun.net.www.http.HttpClient;

import javax.net.ssl.*;

@RestController
public class HelloWorldController {

    @Value("${OTHER_SERVER_HOST}")
    String serverHost;

    @Value("${OTHER_SERVER_PORT}")
    Integer serverPort;

    @Value("${http.client.ssl.trust-store}")
    private Resource keyStore;

    @Value("${http.client.ssl.trust-store-password}")
    private String keyStorePassword;

    @Bean
    RestTemplate restTemplate() throws Exception {
        SSLContext sslContext = new SSLContextBuilder()
                .loadTrustMaterial(
                        keyStore.getURL(),
                        keyStorePassword.toCharArray()
                ).build();
        SSLConnectionSocketFactory socketFactory =
                new SSLConnectionSocketFactory(sslContext);
        HttpClient httpClient = HttpClients.custom()
                .setSSLSocketFactory(socketFactory).build();
        HttpComponentsClientHttpRequestFactory factory =
                new HttpComponentsClientHttpRequestFactory(httpClient);
        return new RestTemplate(factory);
    }

    @RequestMapping("/")
    public String hello() {
        return "hello";
    }

    @Scheduled(initialDelay = 10000, fixedDelay = 10000)
    public void sendServiceRequest() throws Exception {
        SSLContext sc = SSLContext.getInstance("SSL");
        sc.init(null, new TrustManager[] { trm }, null);
        SSLSocketFactory factory =sc.getSocketFactory();
        SSLSocket socket =(SSLSocket)factory.createSocket(serverHost, serverPort);
        socket.startHandshake();
        SSLSession session = socket.getSession();
        java.security.cert.Certificate[] servercerts = session.getPeerCertificates();
        for (int i = 0; i < servercerts.length; i++) {
            System.out.print("-----BEGIN CERTIFICATE-----\n");
            System.out.print(new sun.misc.BASE64Encoder().encode(servercerts[i].getEncoded()));
            System.out.print("\n-----END CERTIFICATE-----\n");
        }

        socket.close();

    }
}