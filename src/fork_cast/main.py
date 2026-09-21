import os
import uvicorn


def main():
    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "127.0.0.1")
    reload = os.getenv("RELOAD", "false").lower() == "true"

    print(f"Starting Fork-Cast API server on http://{host}:{port}")
    uvicorn.run("fork_cast.app:app", host=host, port=port, reload=reload)


if __name__ == "__main__":
    main()
