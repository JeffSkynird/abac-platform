FROM rust:1.80 as builder
WORKDIR /app

# 1. Install the MUSL target for static compilation
RUN rustup target add x86_64-unknown-linux-musl

COPY Cargo.toml .
# Dummy build to cache dependencies for the specific target
RUN mkdir src && echo 'fn main(){}' > src/main.rs && cargo build --target x86_64-unknown-linux-musl --release

COPY src ./src
# 2. Compile the final binary pointing to the static target
RUN cargo build --target x86_64-unknown-linux-musl --release

FROM scratch
COPY --from=builder /app/target/x86_64-unknown-linux-musl/release/pdp /bin/pdp
EXPOSE 8081
ENTRYPOINT ["/bin/pdp"]

