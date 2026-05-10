from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
import hashlib

SECRET_KEY = "sk1234"  
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 8  

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class AuthService:
    def _get_prep_password(self, password: str) -> str:
        """
        Hàm hỗ trợ: Băm mật khẩu thô bằng SHA-256 để đưa về chuỗi 64 ký tự cố định.
        Điều này giúp hỗ trợ mật khẩu dài vô tận mà không bị lỗi 72 bytes của bcrypt.
        """
        return hashlib.sha256(password.encode("utf-8")).hexdigest()

    def hash_password(self, password: str) -> str:
        """
        Hash mật khẩu đã qua lớp đệm SHA-256.
        """
        prepared_pw = self._get_prep_password(password)
        return pwd_context.hash(prepared_pw)

    def verify_password(self, plain: str, hashed: str) -> bool:
        """
        Kiểm tra mật khẩu. Không còn bị crash nếu mật khẩu > 72 bytes.
        """
        try:
            prepared_pw = self._get_prep_password(plain)
            return pwd_context.verify(prepared_pw, hashed)
        except Exception:
            # Trả về False thay vì văng lỗi ValueError nếu có vấn đề kỹ thuật
            return False

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