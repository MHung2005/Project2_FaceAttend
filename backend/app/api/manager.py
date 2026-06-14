"""
backend/app/api/manager.py  (updated)
New endpoints added:
  - POST /manager/employees/bulk-import  — parse Excel/CSV, create employees
  - GET  /manager/analytics/daily        — enriched daily stats (present/late/absent + employee list)
  - GET  /manager/schedule               — get work schedule config
  - PUT  /manager/schedule               — set work schedule (start_time, end_time, grace_minutes)
"""

from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, Query
from pydantic import BaseModel
import numpy as np
import cv2
from datetime import datetime
import io

from ..service.ai.embeddings import FaceEmbeddingService
from ..database.storage import StorageService
from ..api.auth import get_current_manager

db = StorageService()
face_embed = FaceEmbeddingService()
manager_router = APIRouter(prefix="/manager")


# ─────────────────────────────────────────────────────────────────────────────
# EMPLOYEE CRUD
# ─────────────────────────────────────────────────────────────────────────────
@manager_router.post("/employees")
async def create_employee(
    user_id:    str = Form(...),
    name:       str = Form(...),
    department: str = Form(...),
    position:   str = Form(...),
    file: UploadFile = File(...),
    current_manager=Depends(get_current_manager),
):
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        raise HTTPException(status_code=400, detail="Ảnh không hợp lệ")

    vector = face_embed.embedding_img(img)
    if vector is None:
        raise HTTPException(
            status_code=422,
            detail="Không thể nhận diện khuôn mặt. Vui lòng đảm bảo khuôn mặt rõ ràng, đủ ánh sáng và nhìn thẳng vào camera."
        )

    db.add_face(user_id, name, department, position, vector)
    return {"status": "success", "message": f"Đã đăng ký khuôn mặt cho {name}"}


@manager_router.get("/employees")
def list_employees(
    search: str = Query(default="", description="Tìm kiếm theo tên, phòng ban, chức vụ"),
    current_manager=Depends(get_current_manager),
):
    employees = db.get_all_employees()
    if search:
        q = search.lower()
        employees = [
            e for e in employees
            if q in e.get("name", "").lower()
            or q in e.get("department", "").lower()
            or q in e.get("position", "").lower()
            or q in e.get("user_id", "").lower()
        ]
    return {"total": len(employees), "employees": employees}


@manager_router.delete("/employees/{user_id}")
def delete_employee(user_id: str, current_manager=Depends(get_current_manager)):
    if not db.delete_employee(user_id):
        raise HTTPException(status_code=404, detail="Không tìm thấy nhân viên")
    return {"status": "success", "message": f"Đã xóa nhân viên {user_id}"}


class UpdateEmployeeBody(BaseModel):
    name:       str
    department: str
    position:   str


@manager_router.put("/employees/{user_id}")
def update_employee(
    user_id: str,
    body: UpdateEmployeeBody,
    current_manager=Depends(get_current_manager),
):
    if not db.update_employee(user_id, body.name, body.department, body.position):
        raise HTTPException(status_code=404, detail="Không tìm thấy nhân viên")
    return {"status": "success", "message": "Đã cập nhật thông tin"}


# ─────────────────────────────────────────────────────────────────────────────
# BULK IMPORT via Excel / CSV
# ─────────────────────────────────────────────────────────────────────────────
@manager_router.post("/employees/bulk-import")
async def bulk_import_employees(
    file: UploadFile = File(...),
    current_manager=Depends(get_current_manager),
):
    """
    Parse an .xlsx or .csv file and create employee records.

    Expected columns (case-insensitive):
      user_id | name | department | position | email | phone

    Optional columns (used for account creation):
      username | password  (plain — will be hashed)

    Returns a preview summary: {created, skipped, errors, preview}
    """
    filename = file.filename or ""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext not in ("xlsx", "xls", "csv"):
        raise HTTPException(
            status_code=400,
            detail="Chỉ hỗ trợ file .xlsx, .xls hoặc .csv"
        )

    contents = await file.read()

    try:
        rows = _parse_spreadsheet(contents, ext)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Không thể đọc file: {e}")

    if not rows:
        raise HTTPException(status_code=422, detail="File không có dữ liệu hợp lệ")

    # Hash passwords if present
    from ..service.auth_service import AuthService
    auth_svc = AuthService()
    for row in rows:
        plain_pw = row.pop("password", None)
        if plain_pw:
            row["hashed_password"] = auth_svc.hash_password(str(plain_pw))

    result = db.bulk_create_employees(rows)

    return {
        "status":        "success",
        "total_rows":    len(rows),
        "created_count": len(result["created"]),
        "skipped_count": len(result["skipped"]),
        "error_count":   len(result["errors"]),
        "created":       result["created"],
        "skipped":       result["skipped"],
        "errors":        result["errors"],
        "preview":       rows[:10],   # first 10 rows as preview
    }


def _parse_spreadsheet(contents: bytes, ext: str) -> list[dict]:
    """Return list of dicts with normalised column names."""
    COLUMN_MAP = {
        "user_id": "user_id", "mã nv": "user_id", "id": "user_id", "employee_id": "user_id",
        "name": "name", "họ tên": "name", "tên": "name", "full_name": "name",
        "department": "department", "phòng ban": "department", "phòng": "department",
        "position": "position", "chức vụ": "position", "vị trí": "position",
        "email": "email", "e-mail": "email",
        "phone": "phone", "số điện thoại": "phone", "điện thoại": "phone", "sdt": "phone",
        "username": "username", "tên đăng nhập": "username",
        "password": "password", "mật khẩu": "password",
    }

    if ext in ("xlsx", "xls"):
        import openpyxl
        wb = openpyxl.load_workbook(io.BytesIO(contents), read_only=True, data_only=True)
        ws = wb.active
        rows_iter = ws.iter_rows(values_only=True)
    else:
        import csv
        text = contents.decode("utf-8-sig", errors="replace")
        reader = csv.reader(io.StringIO(text))
        rows_iter = iter(reader)

    header_raw = next(rows_iter, None)
    if header_raw is None:
        return []

    header = [str(h).strip().lower() if h is not None else "" for h in header_raw]
    mapped_header = [COLUMN_MAP.get(col, col) for col in header]

    records = []
    for row in rows_iter:
        if all(v is None or str(v).strip() == "" for v in row):
            continue  # skip blank rows
        record = {}
        for col_name, val in zip(mapped_header, row):
            if col_name:
                record[col_name] = str(val).strip() if val is not None else ""
        records.append(record)

    return records


# ─────────────────────────────────────────────────────────────────────────────
# BIOMETRIC APPROVAL
# ─────────────────────────────────────────────────────────────────────────────
@manager_router.get("/employees/pending")
def get_pending(current_manager=Depends(get_current_manager)):
    return {"employees": db.get_pending_employees()}


@manager_router.put("/employees/{user_id}/approve")
def approve_employee(
    user_id: str,
    body: dict,
    current_manager=Depends(get_current_manager),
):
    status = body.get("status", "approved")
    if status not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="Status không hợp lệ")
    if not db.approve_biometric(user_id, status):
        raise HTTPException(status_code=404, detail="Không tìm thấy nhân viên")
    return {"status": "success"}


# ─────────────────────────────────────────────────────────────────────────────
# ATTENDANCE RECORDS
# ─────────────────────────────────────────────────────────────────────────────
@manager_router.get("/attendance")
def get_attendance(
    date: str = None,
    current_manager=Depends(get_current_manager),
):
    if not date:
        date = datetime.now().strftime("%Y-%m-%d")
    records = db.get_checkins_by_date(date)
    return {"date": date, "total": len(records), "records": records}


# ─────────────────────────────────────────────────────────────────────────────
# ANALYTICS — DAILY (enriched: present / late / absent + per-employee status)
# ─────────────────────────────────────────────────────────────────────────────
@manager_router.get("/analytics/daily")
def get_daily_analytics(
    date: str = Query(default=None, description="YYYY-MM-DD, mặc định hôm nay"),
    search: str = Query(default="", description="Tìm kiếm tên / phòng ban"),
    current_manager=Depends(get_current_manager),
):
    analytics = db.get_daily_analytics(date)
    if search:
        q = search.lower()
        analytics["records"] = [
            r for r in analytics["records"]
            if q in r.get("name", "").lower() or q in r.get("department", "").lower()
        ]
    return analytics


# ─────────────────────────────────────────────────────────────────────────────
# LEGACY STATS ENDPOINTS (kept for backward compat)
# ─────────────────────────────────────────────────────────────────────────────
@manager_router.get("/stats")
def get_stats(current_manager=Depends(get_current_manager)):
    today = datetime.now().strftime("%Y-%m-%d")
    analytics = db.get_daily_analytics(today)
    return {
        "today":   analytics["present"],
        "total":   analytics["total_employees"],
        "absent":  analytics["absent"],
        "late":    analytics["late"],
        "on_time": analytics["on_time"],
        "rate":    round((analytics["present"] / analytics["total_employees"] * 100)
                         if analytics["total_employees"] > 0 else 0),
    }


@manager_router.get("/stats/weekly")
def get_weekly(current_manager=Depends(get_current_manager)):
    return {"data": db.get_weekly_checkins()}


@manager_router.get("/stats/range")
def get_checkins_range(
    start_date: str = Query(..., description="YYYY-MM-DD"),
    end_date:   str = Query(..., description="YYYY-MM-DD"),
    current_manager=Depends(get_current_manager),
):
    return {"data": db.get_checkins_by_range(start_date, end_date)}


# ─────────────────────────────────────────────────────────────────────────────
# LOCATION CONFIG
# ─────────────────────────────────────────────────────────────────────────────
@manager_router.put("/location")
def set_location(body: dict, current_manager=Depends(get_current_manager)):
    db.set_location_config(body["lat"], body["lng"], body.get("radius", 200))
    return {"status": "success"}


@manager_router.get("/location")
def get_location(current_manager=Depends(get_current_manager)):
    loc = db.get_location_config()
    return loc or {"lat": None, "lng": None, "radius": 200}


# ─────────────────────────────────────────────────────────────────────────────
# SCHEDULE CONFIG  (start_time, end_time, grace_minutes)
# ─────────────────────────────────────────────────────────────────────────────
class ScheduleBody(BaseModel):
    start_time:     str   # "HH:MM"
    end_time:       str   # "HH:MM"
    grace_minutes:  int = 0


@manager_router.get("/schedule")
def get_schedule(current_manager=Depends(get_current_manager)):
    return db.get_schedule_config()


@manager_router.put("/schedule")
def set_schedule(body: ScheduleBody, current_manager=Depends(get_current_manager)):
    # Basic validation
    for t in (body.start_time, body.end_time):
        parts = t.split(":")
        if len(parts) != 2 or not all(p.isdigit() for p in parts):
            raise HTTPException(status_code=400, detail=f"Định dạng giờ không hợp lệ: {t} (cần HH:MM)")
    if body.grace_minutes < 0:
        raise HTTPException(status_code=400, detail="grace_minutes phải >= 0")
    db.set_schedule_config(body.start_time, body.end_time, body.grace_minutes)
    return {"status": "success", "message": "Đã cập nhật lịch làm việc"}