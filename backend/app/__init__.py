"""
backend/app/__init__.py
Two roles only: employee and manager. No public/guest access.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


def create_app() -> FastAPI:
    app = FastAPI(title="FaceTime & GPS Attendance API", version="2.0.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Routers ──────────────────────────────────────────────────
    from .api.auth import auth_router, employee_auth_router
    from .api.manager import manager_router
    from .api.employee import employee_router

    app.include_router(auth_router)           # /auth/login, /auth/me
    app.include_router(employee_auth_router)  # /auth/employee/login
    app.include_router(manager_router)        # /manager/*
    app.include_router(employee_router)       # /employee/*

    @app.get("/health")
    def health():
        return {"status": "ok"}

    return app