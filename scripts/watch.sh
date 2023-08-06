#!/usr/bin/env bash

concurrently -k -p "[{name}]" -n "TypeScript,Node" -c "cyan.bold,green.bold,yellow.bold" "./scripts/watch-ts.sh" "./scripts/watch-node.sh"