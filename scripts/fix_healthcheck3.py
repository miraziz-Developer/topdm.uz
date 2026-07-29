with open("/opt/bozorliii/docker-compose.yml","r") as f:
    lines = f.readlines()

out = []
for line in lines:
    # Line 96 dagi noto'g'ri healthcheck qatorini to'g'rilash
    if 'python3 -c' in line and 'urlopen("http://127.0.0.1:8000/health")' in line:
        # 4-space indent saqlash
        indent = line[:len(line) - len(line.lstrip())]
        line = indent + '      test: ["CMD-SHELL", "python3 -c \'import urllib.request; urllib.request.urlopen(\\\"http://127.0.0.1:8000/health\\\")\' || exit 1"]\n'
    out.append(line)

with open("/opt/bozorliii/docker-compose.yml","w") as f:
    f.writelines(out)

# verify
with open("/opt/bozorliii/docker-compose.yml","r") as f:
    c = f.read()
print("ok")
