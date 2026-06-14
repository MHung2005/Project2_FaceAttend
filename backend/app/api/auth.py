# backend/api/auth.py
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from ..service.auth_service import AuthService
from ..database.storage import StorageService

auth_router = APIRouter(prefix="/auth")
auth_service = AuthService()
db = StorageService()
security = HTTPBearer()

# --- Schemas ---
class LoginRequest(BaseModel):
    username: str
    password: str

# --- Dependency: xác thực token từ header ---
def get_current_manager(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    token = credentials.credentials
    payload = auth_service.decode_token(token)

    if payload is None:
        raise HTTPException(status_code=401, detail="Token không hợp lệ hoặc đã hết hạn")
    if payload.get("role") != "manager":
        raise HTTPException(status_code=403, detail="Không có quyền truy cập")

    return payload  # trả về {"username": ..., "role": "manager"}

# --- API Login ---
@auth_router.post("/login")
def login(body: LoginRequest):
    manager = db.get_manager(body.username)

    if not manager:
        raise HTTPException(status_code=401, detail="Tài khoản không tồn tại")

    if not auth_service.verify_password(body.password, manager["password"]):
        raise HTTPException(status_code=401, detail="Sai mật khẩu")

    token = auth_service.create_token({
        "username": manager["username"],
        "role": "manager"
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "username": manager["username"]
    }

# --- API kiểm tra token còn hợp lệ không ---
@auth_router.get("/me")
def get_me(current_manager = Depends(get_current_manager)):
    return {
        "username": current_manager["username"],
        "role": current_manager["role"]
    }

employee_auth_router = APIRouter(prefix="/auth")

class EmployeeLoginRequest(BaseModel):
    username: str
    password: str

@employee_auth_router.post("/employee/login")
def employee_login(body: EmployeeLoginRequest):
    acc = db.get_employee_account(body.username)
    if not acc:
        raise HTTPException(status_code=401, detail="Tài khoản không tồn tại")
    if not auth_service.verify_password(body.password, acc["password"]):
        raise HTTPException(status_code=401, detail="Sai mật khẩu")
    token = auth_service.create_token({
        "username": acc["username"],
        "user_id":  acc["user_id"],
        "role":     "employee"
    })
    return {"access_token": token, "token_type": "bearer",
            "username": acc["username"], "user_id": acc["user_id"]}

# Dependency dùng trong RegisterFace của employee
def get_current_employee(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    payload = auth_service.decode_token(credentials.credentials)
    if not payload or payload.get("role") != "employee":
        raise HTTPException(status_code=403, detail="Không có quyền")
    return payload