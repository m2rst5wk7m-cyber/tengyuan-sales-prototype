#!/bin/sh
cd "$(dirname "$0")" || exit 1
if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 is required. Install Python 3, then run this file again."
  printf "Press Enter to close..."
  read answer
  exit 1
fi
python3 start-lan.py "$@"
printf "Press Enter to close..."
read answer
