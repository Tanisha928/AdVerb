FROM golang:1.22-alpine
WORKDIR /app
COPY . .
RUN go build -o decision-engine ./cmd/server
EXPOSE 8080
CMD ["./decision-engine"]
