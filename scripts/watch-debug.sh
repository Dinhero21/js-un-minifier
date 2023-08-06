#!/usr/bin/env bash

concurrently -k -p "[{name}]" -n "TypeScript,Node" -c "yellow.bold,cyan.bold,green.bold" "./scripts/watch-ts.sh" "./scripts/watch-node-debug.sh"