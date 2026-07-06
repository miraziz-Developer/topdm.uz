#!/bin/sh
set -eu

: "${CORE_BACKEND_HOST:?CORE_BACKEND_HOST is required (core server VPC private IP)}"
export CORE_BACKEND_HOST
export NGINX_WORKER_PROCESSES="${NGINX_WORKER_PROCESSES:-2}"

envsubst '${CORE_BACKEND_HOST} ${NGINX_WORKER_PROCESSES}' \
  < /etc/nginx/templates/nginx.conf.template \
  > /etc/nginx/nginx.conf

exec nginx -g 'daemon off;'
