FROM gliderlabs/alpine
MAINTAINER Chris Schmich <schmch@gmail.com>
RUN echo 'http://dl-3.alpinelinux.org/alpine/edge/testing' >> /etc/apk/repositories
RUN apk upgrade --update
RUN apk add vim
RUN apk add openssh
RUN apk add git
RUN apk add nodejs
RUN npm install -g pm2
RUN apk add bash
RUN apk add supervisor
RUN apk add mongodb
RUN mkdir -p /srv/nethex/db
RUN mkdir -p /srv/nethex/www
COPY bashrc /root/.bashrc
COPY supervisord.conf /etc/supervisord.conf
COPY run.sh /root/run.sh
EXPOSE 3000
ENTRYPOINT ["/bin/bash", "/root/run.sh"]
