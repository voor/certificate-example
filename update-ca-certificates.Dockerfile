FROM ubuntu:xenial

RUN apt-get update && apt-get install -y \
	ca-certificates \
    && apt-get purge --auto-remove -y  \
	&& rm -rf /var/lib/apt/lists/*

ENTRYPOINT [ "/usr/sbin/update-ca-certificates" ]