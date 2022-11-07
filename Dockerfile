FROM node:18.11.0-alpine as build

# copy the root package.json an all frontend build deps
# not using a global yarn install, but relying on the
# yarn focus to ensure locked versions
# https://github.com/yarnpkg/berry/issues/1803
WORKDIR /usr/app
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci

COPY src src/
COPY prisma prisma/

ENV NODE_ENV production
RUN npm run build

FROM node:18.11.0-alpine as deps

WORKDIR /usr/app
COPY package.json package-lock.json ./

ENV NODE_ENV production
RUN npm ci --only=prod

FROM node:18.11.0-alpine as server

EXPOSE 3050
ENV NODE_ENV production

WORKDIR /usr/app

COPY --from=deps /usr/app/package.json ./
COPY --from=deps /usr/app/node_modules ./node_modules
COPY --from=build /usr/app/dist ./dist
COPY --from=build /usr/app/prisma ./prisma
COPY .env.prod .env

CMD ["/bin/sh", "-c", "npm run start:prod"]
