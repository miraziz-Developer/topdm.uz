import yaml

with open("docker-compose.core.yml","r") as f:
    c = f.read()

# Replace healthcheck test to use python3 urllib instead of curl
# This is valid YAML inside a JSON-style array
old = 'test: ["CMD-SHELL", "curl -fsS http://127.0.0.1:8000/health >/dev/null || exit 1"]'
new = 'test: ["CMD-SHELL", "python3 -c \'import urllib.request; urllib.request.urlopen(\\\"http://127.0.0.1:8000/health\\\")\' || exit 1"],'

# Read as YAML to properly manipulate
# Parse then update
# Actually safer: just simple string replace since we verified the exact string
c = c.replace(old, new.rstrip(","))

# Validate
data = yaml.safe_load(c)
print("yaml ok")
print("backend healthcheck:", data["services"]["backend"].get("healthcheck", "NONE"))

with open("/tmp/docker-compose-fixed.yml","w") as f:
    f.write(c)
print("written to /tmp/docker-compose-fixed.yml")
