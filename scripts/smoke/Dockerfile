# Clean-room image for the install smoke test.
#
# Deliberately does NOT build from this repo: it only carries Node, the fixtures
# and the scenario. The package under test is pulled from the npm registry at
# run time by smoke.sh, so what we exercise is the published tarball.
ARG NODE_IMAGE=node:20-bookworm-slim
FROM ${NODE_IMAGE}

WORKDIR /smoke

COPY fixtures ./assets
COPY smoke.sh assert.mjs ./

CMD ["sh", "./smoke.sh"]
