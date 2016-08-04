if [ ! -d /srv/nethex/web/node_modules ]; then
  cd /srv/nethex/web
  npm install --no-bin-links
fi
/usr/bin/supervisord -c /etc/supervisord.conf &
cd /srv/nethex/web && /usr/bin/pm2 start server.js --name nethex-web --watch /srv/nethex/web 2>&1 >/dev/null
pm2 list 2>/dev/null
supervisorctl status
exec /bin/bash
