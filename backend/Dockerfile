FROM oven/bun:alpine

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --production

COPY . .

RUN chmod +x /app/docker-entrypoint.sh \
    && mkdir -p /app/uploads

VOLUME ["/app/uploads"]

EXPOSE 3000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
