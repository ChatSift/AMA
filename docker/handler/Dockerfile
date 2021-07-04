FROM node:16-alpine
LABEL name "AMA interactions handler builder"

WORKDIR /opt/build

RUN apk add --update \
&& apk add --no-cache ca-certificates \
&& apk add --no-cache --virtual .build-deps curl git

RUN curl -L https://unpkg.com/@pnpm/self-installer | node

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./

COPY libs/common/package.json ./libs/common/
COPY services/handler/package.json ./services/handler/

RUN pnpm i --frozen-lockfile && apk del .build-deps

COPY libs/common ./libs/common
COPY services/handler ./services/handler

RUN pnpm run build && pnpm prune --prod

FROM node:16-alpine
LABEL name "AMA interactions handler"
LABEL version "0.1.0"

WORKDIR /usr/handler

EXPOSE 3000

COPY --from=0 /opt/build ./

CMD node services/handler/dist/index.js | ./services/handler/node_modules/.bin/pino-pretty -c -l -t
