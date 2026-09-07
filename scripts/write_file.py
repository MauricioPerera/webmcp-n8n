import sys

if len(sys.argv) < 2:
    print("Usage: python write_file.py <target_path>")
    sys.exit(1)

target_path = sys.argv[1]
content = sys.stdin.read()
with open(target_path, "w", encoding="utf-8") as f:
    f.write(content)

print(f"Successfully wrote {len(content)} bytes to {target_path}")
