import re

with open("/opt/bozorliii/docker-compose.yml","r") as f:
    c = f.read()

# Moyit string
old = 'test: ["CMD-SHELL", "python3 -c \'import urllib.request; urllib.request.urlopen("http://127.0.0.1:8000/health")\' || exit 1"]'
# Bu yangi to'g'ri variant - slashla bilan oldindan escape qilingan
new = r'test: ["CMD-SHELL", "python3 -c \'import urllib.request; urllib.request.urlopen(\\\"http://127.0.0.1:8000/health\\\")\' || exit 1"]'

print("old found:", old in c)

if old in c:
    c = c.replace(old, new)
    with open("/opt/bozorliii/docker-compose.yml","w") as f:
        f.write(c)
    print("done")
else:
    print("old not found")
    for i, line in enumerate(c.split("\n"), 1):
        if "healthcheck" in line.lower() or "curl" in line or "python3 -c" in line:
            print(f"L{i}: {line}")
