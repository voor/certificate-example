FROM openjdk:8-slim-stretch

COPY target/*.jar /app/service.jar
COPY scripts/entrypoint.sh entrypoint.sh

RUN ["chmod", "+x", "entrypoint.sh"]

# Avoid delays in startup:
# https://ruleoftech.com/2016/avoiding-jvm-delays-caused-by-random-number-generation
ENV SECURITY_OPTS '-Djava.security.egd=file:/dev/./urandom'

# Make sure that this matches what you are allocating to the kubernetes pod.
ENV JAVA_OPTS '-server -Xms512m -Xmx512m -XX:MaxMetaspaceSize=512m'

# Defines the server ports directly and explicitly to avoid confusion of who sets that
ENV SERVER_PORT '8080'
# Default Spring Boot management port is 8080, which is a security issue, so move it to another port.
ENV MANAGEMENT_PORT '8081'

# expose default service port
EXPOSE 8080
# expose default management port
EXPOSE 8081

# Default to nobody, this can be changed in kubernetes configuration
USER nobody

ENTRYPOINT ["./entrypoint.sh"]

CMD ["/app/service.jar"]
