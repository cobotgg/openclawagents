# CobotClaw Sandbox - Full OpenClaw Gateway Container
# Based on Cloudflare Sandbox image for process management (startProcess, waitForPort)
# OpenClaw runs directly - no boot proxy needed.

FROM docker.io/cloudflare/sandbox:0.7.0

# Install Node.js 22 (required by OpenClaw)
ENV NODE_VERSION=22.13.1
RUN ARCH="$(dpkg --print-architecture)" \
    && case "${ARCH}" in \
         amd64) NODE_ARCH="x64" ;; \
         arm64) NODE_ARCH="arm64" ;; \
         *) echo "Unsupported architecture: ${ARCH}" >&2; exit 1 ;; \
       esac \
    && apt-get update && apt-get install -y xz-utils ca-certificates git rsync \
    && curl -fsSLk https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${NODE_ARCH}.tar.xz -o /tmp/node.tar.xz \
    && tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1 \
    && rm /tmp/node.tar.xz \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm and OpenClaw
RUN npm install -g pnpm openclaw@2026.2.6 \
    && openclaw --version

# Create OpenClaw directories
RUN mkdir -p /root/.openclaw /root/clawd /root/clawd/skills

# Copy startup script
COPY start-openclaw.sh /usr/local/bin/start-openclaw.sh
RUN chmod +x /usr/local/bin/start-openclaw.sh

# Force image rebuild — increment to bust cache
LABEL cobotclaw.build.version="4"

WORKDIR /root/clawd
EXPOSE 18789
