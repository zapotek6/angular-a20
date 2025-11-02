##!/usr/bin/bash

GIT_TAG=`git describe --tags --always`

podman build \
        --manifest registry.pilauno.com/angular-a20:${GIT_TAG} \
        --platform linux/amd64,linux/arm64 \
        --rm \
        --dns=1.1.1.1 \
        . && \
podman push registry.pilauno.com/angular-a20:${GIT_TAG}
