/usr/bin/supervisord -c /etc/supervisord.conf &
cd /srv/nethex/www && /usr/bin/pm2 start server.js --name nethex-web --watch /srv/nethex/www 2>&1 >/dev/null
pm2 list 2>/dev/null
supervisorctl status
exec /bin/bash
