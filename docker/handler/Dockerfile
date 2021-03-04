FROM node:15-alpine
LABEL name "AMA command handler builder"

WORKDIR /opt/build

RUN apk add --update \
&& apk add --no-cache ca-certificates \
&& apk add --no-cache --virtual .build-deps curl git

RUN curl -L https://unpkg.com/@pnpm/self-installer | node

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./

COPY libs/common/package.json ./libs/common/
COPY libs/logger/package.json ./libs/logger/
COPY libs/readdir/package.json ./libs/readdir/
COPY services/handler/package.json ./services/handler/

RUN pnpm i --frozen-lockfile && apk del .build-deps

COPY libs/common ./libs/common
COPY libs/logger ./libs/logger
COPY libs/readdir ./libs/readdir
COPY services/handler ./services/handler

RUN pnpm run build && pnpm prune --prod

FROM node:15-alpine
LABEL name "AMA command handler builder"
LABEL version "0.1.0"

WORKDIR /usr/handler

COPY --from=0 /opt/build ./

CMD ["node", "--enable-source-maps", "services/handler/dist/index.js"]
