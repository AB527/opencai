FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# `frontend/.env` must exist locally (copied from `.env.example`) before this
# build runs. Vite loads it directly during `vite build` and inlines
# VITE_-prefixed values into the built JS -- this is the actual mechanism
# behind "Vite vars are baked in at build time" from PLAN.md's Docker section.
# No Docker ARG/ENV plumbing is needed for this: it is plain Vite behavior.
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
