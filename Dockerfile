FROM node:22-bookworm-slim

ENV PNPM_HOME=/pnpm
ENV PATH="${PNPM_HOME}:${PATH}"
ENV NODE_ENV=production
ENV PORT=3000
ENV UPLOADS_DIR=/app/data/uploads
ENV PUBLIC_DIR=/app/artifacts/travel-hub/dist/public

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json tsconfig.base.json ./
COPY artifacts ./artifacts
COPY lib ./lib
COPY scripts ./scripts
COPY docker-entrypoint.sh ./

RUN pnpm install --frozen-lockfile --prod=false
RUN pnpm run build:coolify

RUN mkdir -p "${UPLOADS_DIR}" \
  && chown -R node:node /app \
  && chmod 755 /app/docker-entrypoint.sh

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/api/healthz').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["pnpm", "--filter", "@workspace/api-server", "run", "start"]