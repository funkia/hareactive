#!/usr/bin/env bash

OLD_DIR="hareactive-old"

cd $(dirname $0)

if [ ! -d "$OLD_DIR" ]; then
    git clone https://github.com/paldepind/hareactive "$OLD_DIR"
    cd "$OLD_DIR"
    npm install
    npm run build
fi

pwd;
