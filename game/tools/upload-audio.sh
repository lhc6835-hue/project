#!/bin/sh
# Upload the game's sound files to the KV namespace the server reads them from (keys "file:/assets/audio/...").
# Run from the game directory; needs Cloudflare API access (the session proxy supplies the token).
ACC=060df99131cdfd285b9912af2fd27b25 NS=39b5fdb05ae3442b972cb9eb1188216f
for f in assets/audio/sfx/*.mp3 assets/audio/music/*.mp3; do
  code=$(curl -sS -o /dev/null -w '%{http_code}' -X PUT "https://api.cloudflare.com/client/v4/accounts/$ACC/storage/kv/namespaces/$NS/values/file:%2F$(echo "$f" | sed 's#/#%2F#g')" \
    -H "content-type: application/octet-stream" --data-binary "@$f")
  echo "$code $f"
done
