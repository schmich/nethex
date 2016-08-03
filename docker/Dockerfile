FROM gliderlabs/alpine
MAINTAINER Chris Schmich <schmch@gmail.com>
RUN apk add --no-cache vim
RUN apk add --no-cache openssh
RUN apk add --no-cache git
RUN apk add --no-cache nodejs
RUN npm install -g pm2
RUN apk add --no-cache bash
RUN apk add --no-cache supervisor
RUN echo 'http://dl-3.alpinelinux.org/alpine/edge/testing' >> /etc/apk/repositories
RUN apk upgrade --update
RUN apk add mongodb
RUN mkdir -p /srv/nethex/db
RUN mkdir -p /srv/nethex/www
COPY bashrc /root/.bashrc
COPY supervisord.conf /etc/supervisord.conf
COPY run.sh /root/run.sh
EXPOSE 3000
ENTRYPOINT ["/bin/bash", "/root/run.sh"]
