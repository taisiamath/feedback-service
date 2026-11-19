"""Входные данные и обработчики запросов для программ курсов."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.database import get_all_courses, save_course, get_course_by_id, update_course

router = APIRouter()


class CourseCreate(BaseModel):
    name: str = Field(min_length=1)
    description: str
    duration_hours: int = Field(gt=0)
    teacher: str


@router.get("/courses")
async def get_courses():
    return get_all_courses()


@router.post("/courses")
async def create_course(course: CourseCreate):
    save_course(course.name, course.description, course.duration_hours, course.teacher)
    return course


@router.get("/courses/{course_id}")
async def get_course(course_id: int):
    course = get_course_by_id(course_id)

    if course is None:
        raise HTTPException(status_code=404, detail="Курс не найден")

    return course


@router.put("/courses/{course_id}")
async def edit_course(course_id: int, course: CourseCreate):
    existing_course = get_course_by_id(course_id)

    if existing_course is None:
        raise HTTPException(status_code=404, detail="Курс не найден")

    update_course(
        course.name,
        course.description,
        course.duration_hours,
        course.teacher,
        course_id,
    )

    return get_course_by_id(course_id)
