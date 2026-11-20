import sqlite3


def get_connection():
    connection = sqlite3.connect("feedback.db")
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def create_tables():
    connection = get_connection()

    connection.execute("""
        CREATE TABLE IF NOT EXISTS courses (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT NOT NULL,
            duration_hours INTEGER NOT NULL,
            teacher TEXT NOT NULL
        )
    """)

    connection.execute("""
        CREATE TABLE IF NOT EXISTS course_groups (
        id INTEGER PRIMARY KEY,
        course_id INTEGER NOT NULL,
        date_start TEXT NOT NULL,
        date_end TEXT NOT NULL,
        FOREIGN KEY (course_id) REFERENCES courses(id)
)
    """)

    connection.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY,
            email TEXT NOT NULL UNIQUE,
            role TEXT NOT NULL 
                CHECK (role IN ('admin', 'teacher', 'student')),
            password_hash TEXT
        )
    """)

    connection.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            token_hash TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            expires_at INTEGER NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)

    connection.commit()
    connection.close()


def save_course(name, description, duration_hours, teacher):
    connection = get_connection()

    connection.execute(
        """
        INSERT INTO courses (name, description, duration_hours, teacher)
        VALUES (?, ?, ?, ?)
        """,
        (name, description, duration_hours, teacher),
    )

    connection.commit()
    connection.close()


def get_all_courses():
    connection = get_connection()
    connection.row_factory = sqlite3.Row

    result = connection.execute("SELECT * FROM courses")
    rows = result.fetchall()

    connection.close()

    courses = []
    for row in rows:
        courses.append(dict(row))

    return courses


def get_course_by_id(
    course_id,
):
    connection = get_connection()
    connection.row_factory = sqlite3.Row

    result = connection.execute("SELECT * FROM courses WHERE id = ?", (course_id,))
    row = result.fetchone()

    connection.close()

    if row is not None:
        return dict(row)

    return None


def update_course(name, description, duration_hours, teacher, course_id):
    connection = get_connection()

    connection.execute(
        """
        UPDATE courses
        SET name = ?,
            description = ?,
            duration_hours = ?,
            teacher = ?
        WHERE id = ?
        """,
        (name, description, duration_hours, teacher, course_id),
    )

    connection.commit()
    connection.close()


def save_group(course_id, date_start, date_end):
    connection = get_connection()

    connection.execute(
        """
        INSERT INTO course_groups (course_id, date_start, date_end)
        VALUES (?, ?, ?)
        """,
        (course_id, date_start.isoformat(), date_end.isoformat()),
    )

    connection.commit()
    connection.close()


def get_all_groups():
    connection = get_connection()
    connection.row_factory = sqlite3.Row

    result = connection.execute("SELECT * FROM course_groups")
    rows = result.fetchall()

    connection.close()

    groups = []
    for row in rows:
        groups.append(dict(row))

    return groups


def get_group_by_id(
    group_id,
):
    connection = get_connection()
    connection.row_factory = sqlite3.Row

    result = connection.execute("SELECT * FROM course_groups WHERE id = ?", (group_id,))
    row = result.fetchone()

    connection.close()

    if row is not None:
        return dict(row)

    return None


def update_group(course_id, date_start, date_end, group_id):
    connection = get_connection()

    connection.execute(
        """
        UPDATE course_groups
        SET course_id = ?,
            date_start = ?,
            date_end = ?
        WHERE id = ?
        """,
        (course_id, date_start.isoformat(), date_end.isoformat(), group_id),
    )

    connection.commit()
    connection.close()


def save_user(email, role, password_hash):
    connection = get_connection()

    connection.execute(
        """
        INSERT INTO users (email, role, password_hash)
        VALUES (?, ?, ?)
        """,
        (email, role, password_hash),
    )

    connection.commit()
    connection.close()


def get_user_by_email(email):
    connection = get_connection()
    connection.row_factory = sqlite3.Row

    result = connection.execute("SELECT * FROM users WHERE email = ?", (email,))
    row = result.fetchone()

    connection.close()

    if row is not None:
        return dict(row)

    return None


def save_session(token_hash, user_id, expires_at):
    connection = get_connection()
    connection.execute(
        """
        INSERT INTO sessions (token_hash, user_id, expires_at)
        VALUES (?, ?, ?)
        """,
        (token_hash, user_id, expires_at),
    )

    connection.commit()
    connection.close()
