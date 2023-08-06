#!/bin/bash

cd "$(dirname "$0")"

npm pack "$(cat packages.txt)" --pack-destination tarballs

for file in tarballs/*
do
  OUT="packages/$(basename $file)"
  mkdir "$OUT"
  tar -xf "$file" --directory "$OUT"
done