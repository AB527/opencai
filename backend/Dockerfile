FROM node:24-slim

WORKDIR /app
ENV NODE_ENV=production

# Prisma's query engine links against OpenSSL; node:24-slim (Debian) doesn't
# ship it by default on every base variant, so install it explicitly rather
# than depend on the base image happening to include it.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

# Copy only what `npm ci`'s postinstall (`prisma generate`) needs first, so
# Docker's layer cache is invalidated by source changes, not by a schema-only
# change re-running the full install.
COPY package.json package-lock.json prisma.config.js ./
COPY prisma ./prisma
RUN npm ci --omit=dev

COPY . .

EXPOSE 4000

# Migrations run every start, not just the first: `prisma migrate deploy` is a
# no-op when the schema is already up to date, so this is safe to repeat.
CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]
