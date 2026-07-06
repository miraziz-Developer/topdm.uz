#!/bin/sh
set -eu

: "${CORE_BACKEND_HOST:?CORE_BACKEND_HOST is required (core server VPC private IP)}"

export CORE_BACKEND_HOST

envsubst '${CORE_BACKEND_HOST}' \
  < /etc/nginx/templates/nginx.conf.template \
  > /etc/nginx/nginx.conf

exec nginx -g 'daemon off;'
