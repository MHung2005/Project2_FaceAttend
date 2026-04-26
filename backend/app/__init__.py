# __init__.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api.guest import guest_router
from .api.manager import manager_router
from .api.auth import auth_router          
from .service.storage import StorageService
from .service.auth_service import AuthService

def create_app():
    app = FastAPI()

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(guest_router)
    app.include_router(manager_router)
    app.include_router(auth_router)        

    _init_default_manager()

    return app

def _init_default_manager():
    db = StorageService()
    auth = AuthService()

    DEFAULT_USERNAME = "admin"
    DEFAULT_PASSWORD = "admin123"  

    if not db.get_manager(DEFAULT_USERNAME):
        hashed = auth.hash_password(DEFAULT_PASSWORD)
        db.save_manager(DEFAULT_USERNAME, hashed)
        print(f"✅ Đã tạo tài khoản manager mặc định: {DEFAULT_USERNAME}")