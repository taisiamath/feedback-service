from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.courses import router
from app.groups import router as groups_router
from app.auth import router as auth_router

app = FastAPI()
app.mount(
    "/static",
    StaticFiles(directory=Path(__file__).resolve().parent / "static"),
    name="static",
)
app.include_router(router)
app.include_router(groups_router)
app.include_router(auth_router)


@app.get("/", include_in_schema=False)
def home():
    """Рабочий интерфейс; API остаётся по адресам /courses и /groups."""
    return FileResponse(Path(__file__).resolve().parent / "static" / "index.html")
