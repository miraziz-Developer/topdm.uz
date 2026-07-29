with open("/opt/bozorliii/docker-compose.yml", "r") as f:
    c = f.read()

old = 'test: ["CMD-SHELL", "curl -fsS http://127.0.0.1:8000/health >/dev/null || exit 1"]'
new = 'test: ["CMD-SHELL", "python3 -c \'import urllib.request; urllib.request.urlopen(\"http://127.0.0.1:8000/health\")\' || exit 1"]'

print("old found:", old in c)

if old in c:
    c = c.replace(old, new)
    with open("/opt/bozorliii/docker-compose.yml", "w") as f:
        f.write(c)
    print("done")
else:
    print("old not found, showing current healthcheck line:")
    for line in c.split("\n"):
        if "healthcheck" in line or ("curl" in line and "8000" in line):
            print(line)
