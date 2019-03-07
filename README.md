# Generating Certificates and Serving Them Up in K8S

This short tutorial will walk through creating your own sample CA, adding that sample CA to a bundle, generating a server certificate for that CA, standing up a very basic Spring Boot server with that certificate, doing the same thing in ExpressJS, and then doing some basic calls to those two servers with a service that has the CA incorporated into its bundle.  We'll do all of this with mounting instead of baking the certificate into the container images, so that we can then rotate everything and have it still work the same.

## Prerequisites

This tutorial assumes you're on a Linux or Unix-like terminal, and you have the following available:

* `openssl`
* `keytool` (just for java steps)
* `docker` (just for generating the CA bundle)
* `kubectl` and a friendly neighborhood k8s cluster. (minikube is fine)

## Initial Certificate Work

This assumes you're starting from nothing, and you don't have an existing CA and signed certificates from that CA.  If you already have a CA and server certificate, feel free to skip this section and just note the file names.  After you're done you should have:

```
ca.crt
server.crt
server.key
```

### Make your original CA

First we'll need to generate the CA, bundle it with everything from the [Mozilla Network Security Services (NSS)](https://www.mozilla.org/en-US/about/governance/policies/security-group/certs/policy/), and additionally incorporate that into a Java keystore (for use in Java Applications).

```
openssl genrsa -out ca.key 4096
openssl req -new -x509 -days 1 -key ca.key -subj "/C=US/ST=MD/L=EC/O=Acme, Inc./CN=Acme Root CA" -out ca.crt
```

### Sign a Server with the CA

Next we need to create a new server key and signing request.

```
openssl req -newkey rsa:2048 -nodes -keyout server.key -subj "/C=US/ST=MD/L=EC/O=Acme, Inc./CN=*.example.com" -out server.csr
```

If you want to see the contents, you can output to confirm like this:

```
openssl req -in server.csr -noout -text
```

Next, we need to sign the actual request, we'll also pass in some alternative names:

```
openssl x509 -req -extfile <(printf "subjectAltName=DNS:example.com,DNS:www.example.com") -days 1 -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out server.crt
```

If this isn't the first time you're signing a request, you'll need to change `-CAcreateserial` to `-CAserial ca.srl` instead.

## Application Prep

This is either your starting point if you already have a Certificate Authority (CA) and Server Certificate, or you're about to start the good stuff after the prework!

At this point you should have the following files (if you went through the prework you'll have some others, don't worry about them for now):

```
ca.crt
server.crt
server.key
```

### Create a Java Keystore (Java Only)

Java Servers like things in their own little `keystore.jks` files, so let's go ahead and add our certificates into the keystore.

```
keytool -noprompt -import -alias spring -file server.crt -keystore keystore.p12 -storepass password
```

### Create your CA Bundle

You have your CA, but what about public trusted CAs?  You can either say _to heck with them_ (maybe because you want to make sure you're **only** trusting things coming from your proxy), or if you're choosing to ignore well-known providers (like Google for example) then you want to incorporate the everything that's part of the typical `ca-certificates.crt` you would expect in most containers.  You can either concatenate all of those certs into your own bundle, or follow these steps for an easy way to do that:

```
mkdir -p ca-certificates
mkdir -p certs
cp ca.crt ca-certificates/ca.crt
docker build -t update-ca-certificates -f update-ca-certificates.Dockerfile .
docker run -it --rm --name certs -v $PWD/ca-certificates/:/usr/local/share/ca-certificates:Z -v $PWD/certs/:/etc/ssl/certs:Z update-ca-certificates
```

You should now have a `ca-certificates.crt` file that is really long and contains your CA along with the other publicly trusted ones.