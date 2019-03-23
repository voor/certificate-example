# Generating Certificates and Serving Them Up in K8S

This short tutorial will walk through:

1. Creating your own sample CA
1. Generating a server certificate for that CA
1. Adding that sample CA to a bundle of publicly trusted certificates.
1. Standing up a very basic Spring Boot server with that certificate
1. Doing the same thing in ExpressJS
1. Doing some basic calls to those two servers with a service that has the CA incorporated into its bundle.

We'll do all of this with kubernetes volume mounts and secrets instead of baking the certificate into the container images, so that we can then rotate everything and have it still work the same.

## Prerequisites

This tutorial assumes you're on a Linux or Unix-like terminal, and you have the following available:

- `openssl`
- `keytool` (just for java steps)
- `docker` (just for generating the CA bundle)
- `kubectl` and a friendly neighborhood k8s cluster. (Minikube is fine, I'll be using [PKS](https://pivotal.io/platform/pivotal-container-service))

## Initial Certificate Work

This assumes you're starting from nothing, and you don't have an existing CA and signed certificates from that CA. If you already have a CA and server certificate, feel free to skip this section and just note the file names. After you're done you should have:

```
ca.crt
server.crt
server.key
```

### Make your original CA

First we'll need to generate the CA, bundle it with everything from the [Mozilla Network Security Services (NSS)](https://www.mozilla.org/en-US/about/governance/policies/security-group/certs/policy/), and additionally incorporate that into a Java keystore (for use in Java Applications).

```
openssl genrsa -out ca.key 4096
openssl req -new -x509 -days 2 -key ca.key -subj "/C=US/ST=MD/L=EC/O=Acme, Inc./CN=Acme Root CA" -out ca.crt
```

### Sign a Server with the CA

1. Create a new server key and signing request.
    ```
    openssl req -newkey rsa:2048 -nodes -keyout server.key -subj "/C=US/ST=MD/L=EC/O=Acme, Inc./CN=*.cluster.local" -out server.csr
    ```
    If you want to see the contents, you can output to confirm like this:
    ```
    openssl req -in server.csr -noout -text
    ```
1. Sign the actual request, we'll also pass in some alternative names:
    ```
    openssl x509 -req -extfile <(printf "subjectAltName=DNS:nodejs,DNS:java,DNS:nodejs.default.svc.cluster.local,DNS:java.default.svc.cluster.local,DNS:www.example.com,DNS:*.cluster.local") -days 1 -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out server.crt
    ```
    _If this isn't the first time you're signing a request, you'll need to change `-CAcreateserial` to `-CAserial ca.srl` instead. (Or don't, but you'll overwrite the existing one)_

## Application Prep

This is either your starting point if you already have a Certificate Authority (CA) and Server Certificate, or you're about to start the good stuff after the prework!

At this point you should have the following files (if you went through the prework you'll have some others, don't worry about them for now):

```
ca.crt
server.crt
server.key
```

### Create a Java Keystore (Java Only)

Java Servers like things in their own little PKCS12 files, so let's go ahead and change our certificate into that format.

```
openssl pkcs12 -export -in server.crt -inkey server.key -name spring -out keystore.p12 -nodes -password pass:changeit
```

### Create your CA Bundle

You have your CA, but what about public trusted CAs? You can either say _to heck with them_ (maybe because you want to make sure you're **only** trusting things coming from your proxy), or if you're choosing to ignore well-known providers (like Google for example) then you want to incorporate everything that is part of the typical `ca-certificates.crt` you would expect in most containers. You can either concatenate all of those certs into your own bundle, or follow these steps for an easy way to do that:

```
mkdir -p ca-certificates && mkdir -p certs
cp ca.crt ca-certificates/ca.crt
docker run -it --rm --name certs --entrypoint update-ca-certificates -v $PWD/ca-certificates/:/usr/local/share/ca-certificates:Z -v $PWD/certs/:/etc/ssl/certs:Z node 
```

You should now have a `certs/ca-certificates.crt` file that is really long and contains your CA along with the other publicly trusted ones.

### Create your Trust Store

Java doesn't use a CA bundle, they instead use a truststore, which means we need to do something a little different for Java.

```
mkdir -p certs/java
# Grab the standard truststore for openjdk
docker run -it --rm -u $UID --name java-truststore --entrypoint cp \
    -v $PWD/certs/:/output:Z openjdk \
    /etc/ssl/certs/java/cacerts /output/java/cacerts
# Add our CA to the keystore.
keytool -noprompt -import -alias myca -file ca.crt -keystore certs/java/cacerts -storepass changeit -trustcacerts
# Check that it's there with all the others.
keytool -list -keystore certs/java/cacerts -noprompt -storepass changeit
```

You should now have a `certs/java/cacerts` file that is a binary and contains your CA along with the other publicly trusted ones.

### Create your Servers

Now we want to create some servers inside our cluster that have the associated certificates attached in a rotatable fashion.

#### Java

See [Building a RESTful Web Service](https://spring.io/guides/gs/rest-service/) for creating a simple service, but some extremely basic code is also in the `servers/java` folder, including a `Dockerfile`. If you don't even want to do that, this exact service is also available at [Docker Hub](https://cloud.docker.com/u/voor/repository/docker/voor/java-service)

#### Node

Very basic ExpressJS server is located in `servers/node` folder, including a `Dockerfile`, although if you don't have a Docker registry handy this same code is hosted at [Docker Hub](https://cloud.docker.com/u/voor/repository/docker/voor/node-service)

### Deploy Certificate and Keystore

1. Add our CA certificate bundle
    ```
    kubectl create secret generic castore --from-file=ca-certificates.crt=./certs/ca-certificates.crt
    ```

1. Create the **keystore** for the Java service
    ```
    # This assumes you're in the directory where we created the keystore.p12 from above using the same alias and password!
    kubectl create secret generic java-keystore --from-literal=alias="spring" --from-literal=password="changeit" --from-file=keystore.p12=keystore.p12
    ```

1. Create the server certificate secret that we generated and signed with our CA earlier on for our ExpressJS server.
    ```
    kubectl create secret tls server-cert --cert server.crt --key server.key
    ```
1. Create the **truststore** for Java
    ```
    kubectl create secret generic java-truststore --from-file=cacerts=./certs/java/cacerts
    ```

### Deploy our Servers

We have two different deployments, one for the Java service and one for the Node service. Each service will make a simple call the other service to test our certificates to make sure they are trusted.

Deploy the Java service:

```
kubectl apply -f java-deploy.yml
```

And deploy the NodeJS service:

```
kubectl apply -f node-deploy.yml
```

After the deployments have a running pod, you can check the logs (`kubectl logs deploy/nodejs -f`) to see the calls between each service successfully validated against their CA bundle (NodeJS) or truststore (Java):

NodeJS:
```
server started on port 8443
client connected, it is:  authorized
Subject: {"C":"US","ST":"MD","L":"EC","O":"Acme, Inc.","CN":"*.cluster.local"}
Issuer: {"C":"US","ST":"MD","L":"EC","O":"Acme, Inc.","CN":"Acme Root CA"}
```

Java:
```
2019-03-23 17:40:22.260  INFO 1 --- [   scheduling-1] com.example.demo.HelloWorldController    : Successfully connected and validated with truststore.
```