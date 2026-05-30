# syntax=docker/dockerfile:1
FROM nginx:1.27-alpine

RUN rm -f /etc/nginx/conf.d/default.conf \
    && mkdir -p /var/www/certbot /etc/nginx/ssl

COPY production.conf /etc/nginx/nginx.conf

EXPOSE 80 443

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:80/ >/dev/null 2>&1 || exit 1
