FROM golang:1.27-alpine AS builder
WORKDIR /app
COPY backend/services/documentation/ .
RUN go mod tidy
RUN CGO_ENABLED=0 go build -o /tagent-documentation ./cmd/server

FROM alpine:3.24
RUN apk --no-cache add ca-certificates
COPY --from=builder /tagent-documentation /usr/local/bin/
EXPOSE 8086
CMD ["tagent-documentation"]
