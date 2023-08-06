#!/bin/bash

cd "$(dirname "$0")"

for package in $(cat packages.txt)
do
  npm pack "$package" --pack-destination tarballs
done

for file in tarballs/*
do
  OUT="packages/$(basename $file)"
  mkdir "$OUT"
  tar -xf "$file" --directory "$OUT"
done