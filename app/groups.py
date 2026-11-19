from datetime import date
from pydantic import BaseModel

from fastapi import APIRouter, HTTPException

from app.database import (
    save_group,
    get_course_by_id,
    get_all_groups,
    get_group_by_id,
    update_group,
)

router = APIRouter()


class GroupCreate(BaseModel):
    course_id: int
    date_start: date
    date_end: date


@router.post("/groups")
async def create_group(group: GroupCreate):
    course = get_course_by_id(group.course_id)

    if course is None:
        raise HTTPException(
            status_code=404,
            detail="Программа курса не найдена",
        )

    if group.date_end < group.date_start:
        raise HTTPException(
            status_code=422,
            detail="Дата окончания не может быть раньше даты начала",
        )

    save_group(group.course_id, group.date_start, group.date_end)
    return group


@router.get("/groups")
async def get_groups():
    return get_all_groups()


@router.get("/groups/{group_id}")
async def get_group(group_id: int):
    group = get_group_by_id(group_id)

    if group is None:
        raise HTTPException(status_code=404, detail="Группа не найдена")

    return group


@router.put("/groups/{group_id}")
async def edit_group(group_id: int, group: GroupCreate):
    existing_group = get_group_by_id(group_id)

    if existing_group is None:
        raise HTTPException(status_code=404, detail="Группа не найдена")

    if group.date_end < group.date_start:
        raise HTTPException(
            status_code=422,
            detail="Дата окончания не может быть раньше даты начала",
        )

    course = get_course_by_id(group.course_id)

    if course is None:
        raise HTTPException(
            status_code=404,
            detail="Программа курса не найдена",
        )

    update_group(
        group.course_id,
        group.date_start,
        group.date_end,
        group_id,
    )

    return get_group_by_id(group_id)
