# ====== build ======
FROM rust:1.82-slim AS builder
WORKDIR /app
RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential pkg-config ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY Cargo.toml Cargo.lock ./
COPY src ./src
RUN cargo build --locked --release --bin pdp \
 && ls -l target/release/pdp

# ====== runtime ======
FROM debian:bookworm-slim
WORKDIR /app
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl tini \
 && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/pdp /bin/pdp
RUN chmod +x /bin/pdp
ENV RUST_LOG=debug RUST_BACKTRACE=1
EXPOSE 8081
ENTRYPOINT ["/usr/bin/tini","--"]
CMD ["/bin/pdp"]
