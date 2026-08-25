FROM nginx:1.27-alpine

# htpasswd utility — used by the entrypoint script to generate the basic-auth
# file at container start from environment variables (no secrets in the image).
RUN apk add --no-cache apache2-utils

# Static content — the single sensitive document, served as the index page.
COPY docs/Mapa_Processos_Vivos_TKC.html /usr/share/nginx/html/index.html

# Nginx site config: enforces HTTP Basic Auth on every request.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# The official nginx image runs every executable in /docker-entrypoint.d/
# before starting nginx. This script builds /etc/nginx/.htpasswd from
# BASIC_AUTH_USER / BASIC_AUTH_PASSWORD at runtime.
COPY docker-entrypoint.sh /docker-entrypoint.d/40-basic-auth.sh
RUN chmod +x /docker-entrypoint.d/40-basic-auth.sh

EXPOSE 80
