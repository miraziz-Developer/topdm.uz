#!/usr/bin/env python3
"""Nginx config ga HTTPS server blocks qo'shish"""

with open('/opt/bozorliii/deploy/nginx/production.conf', 'r') as f:
    content = f.read()

https_blocks = """
    # HTTPS: bozorliii.online
    server {
        listen 443 ssl;
        listen [::]:443 ssl;
        http2 on;
        server_name bozorliii.online www.bozorliii.online;

        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 10m;

        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;

        location = /landing {
            alias /usr/share/nginx/html/landing.html;
            default_type text/html;
        }

        location /api/v1/media/ {
            proxy_pass http://bozor_backend;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_buffering on;
            proxy_cache bozor_media;
            proxy_cache_valid 200 206 30d;
        }

        location /api/v1/ {
            proxy_pass http://bozor_frontend;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection $connection_upgrade;
            proxy_buffering off;
        }

        location = /health {
            proxy_pass http://bozor_backend/health;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
        }

        location /ws/ {
            proxy_pass http://bozor_backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection $connection_upgrade;
            proxy_set_header Host $host;
            proxy_buffering off;
            proxy_read_timeout 3600s;
        }

        location / {
            proxy_pass http://bozor_frontend;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection $connection_upgrade;
        }
    }

    # HTTPS: crm.bozorliii.online
    server {
        listen 443 ssl;
        listen [::]:443 ssl;
        http2 on;
        server_name crm.bozorliii.online;

        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;

        location /api/v1/ {
            proxy_pass http://bozor_backend;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_buffering off;
        }

        location / {
            proxy_pass http://bozor_merchant_crm;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection $connection_upgrade;
        }
    }

    # HTTPS: api.bozorliii.online
    server {
        listen 443 ssl;
        listen [::]:443 ssl;
        http2 on;
        server_name api.bozorliii.online;

        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;

        location / {
            proxy_pass http://bozor_backend;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_buffering off;
        }
    }
}
"""

content = content.rstrip()
if content.endswith('}'):
    content = content[:-1] + https_blocks

with open('/opt/bozorliii/deploy/nginx/production.conf', 'w') as f:
    f.write(content)

print('HTTPS_BLOCKS_ADDED OK')
print(f'Total lines: {len(content.splitlines())}')
