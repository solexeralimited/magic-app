#!/bin/bash
# Creates minimal PNG placeholders using ImageMagick (brew install imagemagick)
# Or manually drop your own icon-72.png, icon-192.png, icon-512.png into public/icons/

ICONS_DIR="$(dirname "$0")/../public/icons"
mkdir -p "$ICONS_DIR"

for size in 72 192 512; do
  convert -size ${size}x${size} xc:'#2563eb' \
    -fill white -gravity center \
    -pointsize $((size/3)) -annotate 0 "DW" \
    "$ICONS_DIR/icon-${size}.png" 2>/dev/null || \
  # Fallback: create a minimal 1x1 blue PNG if imagemagick not available
  printf '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x1f%\x03\x00\x02\xf0\x00\xefW\xa8\xa1\x9b\x00\x00\x00\x00IEND\xaeB`\x82' > "$ICONS_DIR/icon-${size}.png"
  echo "Created icon-${size}.png"
done
