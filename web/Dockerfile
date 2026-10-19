# Build the React app, then serve the static bundle with NGINX.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Defaults come from .env.production; override per build, e.g.
#   docker build --build-arg VITE_API_BASE_URL=https://<web-function-endpoint> .
ARG VITE_API_BASE_URL
ARG VITE_UPLOAD_BASE_URL
# An empty variable would override .env.production, so drop the ones not passed.
RUN [ -n "$VITE_API_BASE_URL" ] || unset VITE_API_BASE_URL; \
    [ -n "$VITE_UPLOAD_BASE_URL" ] || unset VITE_UPLOAD_BASE_URL; \
    npm run build

FROM nginx:alpine
RUN rm -rf /usr/share/nginx/html/*
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
