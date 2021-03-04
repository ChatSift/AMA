FROM postgres:12-alpine

LABEL name "AMA bot postgresql"

COPY *.sql /docker-entrypoint-initdb.d/
