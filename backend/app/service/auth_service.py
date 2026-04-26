# backend/service/auth_service.py
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext

SECRET_KEY = "sk1234"  
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 8  

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class AuthService:
    # Hash password
    def hash_password(self, password: str) -> str:
        return pwd_context.hash(password)

    # Kiểm tra password
    def verify_password(self, plain: str, hashed: str) -> bool:
        return pwd_context.verify(plain, hashed)

    # Tạo JWT token
    def create_token(self, data: dict) -> str:
        payload = data.copy()
        expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
        payload.update({"exp": expire})
        return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

    # Giải mã và xác thực token
    def decode_token(self, token: str) -> dict | None:
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            return payload
        except JWTError:
            return None