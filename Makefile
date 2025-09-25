PROTO_DIR=proto
OUT_DIR=generated

.PHONY: proto
proto:
	mkdir -p $(OUT_DIR)
	@echo "👉 SDK generation..."
