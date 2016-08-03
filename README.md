# nethex

## Docker

- `git clone https://github.com/schmich/nethex`
- `cd nethex/docker`
- `docker build -f Dockerfile --tag schmich/nethex .`
- `docker run -p 3000:3000 -it -v ~/dev/nethex:/srv/nethex/www schmich/nethex`
- `http://localhost:3000`
