# syntax=docker/dockerfile:1
FROM nginx:1.27-alpine

RUN apk add --no-cache curl \
    && rm -f /etc/nginx/conf.d/default.conf \
    && mkdir -p /var/www/certbot /etc/nginx/ssl

COPY production.conf /etc/nginx/nginx.conf

EXPOSE 80 443

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -fsSk https://127.0.0.1/health -H "Host: bozorliii.online" >/dev/null 2>&1 || exit 1
