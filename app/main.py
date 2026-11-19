from fastapi import FastAPI

from app.courses import router
from app.groups import router as groups_router

app = FastAPI()
app.include_router(router)
app.include_router(groups_router)
