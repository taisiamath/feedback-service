from getpass import getpass

from app.database import get_user_by_email, save_user
from app.security import hash_password

email = input("Рабочая почта администратора: ").strip().lower()

if email.count("@") != 1 or not email.endswith("@uwca.ru") or email.startswith("@"):
    raise SystemExit("Нужна рабочая почта вида name@uwca.ru")

existing_user = get_user_by_email(email)

if existing_user is not None:
    raise SystemExit("Пользователь с такой почтой уже существует")

password = getpass("Пароль администратора: ")
password_repeat = getpass("Повторите пароль: ")

if not password:
    raise SystemExit("Пароль не должен быть пустым")
if password != password_repeat:
    raise SystemExit("Пароли не совпадают")

password_hash = hash_password(password)
save_user(email, "admin", password_hash)

print("Учётная запись администратора создана")
