"""
backend/app/api/employee.py
Employee-facing endpoints:
  - POST /employee/checkin        (face + GPS)
  - POST /employee/checkout       (face + GPS)
  - POST /employee/register-face  (register/update own face embedding)
  - GET  /employee/stats/monthly  (monthly summary)
  - GET  /employee/attendance     (personal attendance log by date range)
  - GET  /employee/profile        (own profile info)
"""

from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, Query
from pydantic import BaseModel
import numpy as np
import cv2
from datetime import datetime

from ..service.ai.embeddings import FaceEmbeddingService
from ..service.gps_service import is_within_radius
from ..database.storage import StorageService
from ..api.auth import get_current_employee

employee_router = APIRouter(prefix="/employee")
db = StorageService()
face_embed = FaceEmbeddingService()


# ─────────────────────────────────────────────────────────────────────────────
# CHECK-IN  (face + GPS)
# ─────────────────────────────────────────────────────────────────────────────
@employee_router.post("/checkin")
async def employee_checkin(
    file: UploadFile = File(...),
    lat:  float | None = Form(None),
    lng:  float | None = Form(None),
    current_employee=Depends(get_current_employee),
):
    user_id = current_employee["user_id"]

    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        raise HTTPException(status_code=400, detail="Ảnh không hợp lệ")

    vector = face_embed.embedding_img(img)
    if vector is None:
        raise HTTPException(status_code=422, detail="Không nhận diện được khuôn mặt. Vui lòng đảm bảo khuôn mặt rõ ràng, đủ ánh sáng.")

    result = db.search_face(vector)
    if result is None or result["score"] < 0.85:
        raise HTTPException(status_code=401, detail="Khuôn mặt không khớp với hồ sơ đã đăng ký")

    if result["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Khuôn mặt không khớp tài khoản đang đăng nhập")

    # Biometric status check
    emp_data = db.redisDB.hgetall(f"employee:{user_id}")
    bio_status = emp_data.get(b"biometric_status", b"approved").decode()
    if bio_status == "pending":
        raise HTTPException(status_code=403, detail="Khuôn mặt chưa được duyệt bởi quản lý")
    if bio_status == "rejected":
        raise HTTPException(status_code=403, detail="Khuôn mặt bị từ chối, vui lòng đăng ký lại")

    # GPS check
    if lat is not None and lng is not None:
        loc = db.get_location_config()
        if loc:
            if not is_within_radius(lat, lng, loc["lat"], loc["lng"], loc["radius"]):
                raise HTTPException(status_code=403, detail="Bạn không trong phạm vi cho phép điểm danh")

    gps_ok = lat is not None and lng is not None

    if db.is_checked_in_today(user_id):
        raise HTTPException(status_code=409, detail="Bạn đã điểm danh hôm nay rồi")

    timestamp, status = db.save_checkin(
        user_id=user_id,
        name=result["name"],
        department=result["department"],
        position=result["position"],
        lat=lat, lng=lng, gps_ok=gps_ok,
    )

    return {
        "status":     "success",
        "message":    f"Điểm danh thành công — {status}",
        "name":       result["name"],
        "department": result["department"],
        "position":   result["position"],
        "timestamp":  timestamp,
        "checkin_status": status,
    }


# ─────────────────────────────────────────────────────────────────────────────
# CHECK-OUT  (face + GPS)
# ─────────────────────────────────────────────────────────────────────────────
@employee_router.post("/checkout")
async def employee_checkout(
    file: UploadFile = File(...),
    lat:  float | None = Form(None),
    lng:  float | None = Form(None),
    current_employee=Depends(get_current_employee),
):
    user_id = current_employee["user_id"]

    if not db.is_checked_in_today(user_id):
        raise HTTPException(status_code=400, detail="Bạn chưa điểm danh hôm nay")
    if db.is_checked_out_today(user_id):
        raise HTTPException(status_code=409, detail="Bạn đã check-out hôm nay rồi")

    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        raise HTTPException(status_code=400, detail="Ảnh không hợp lệ")

    vector = face_embed.embedding_img(img)
    if vector is None:
        raise HTTPException(status_code=422, detail="Không nhận diện được khuôn mặt")

    result = db.search_face(vector)
    if result is None or result["score"] < 0.85 or result["user_id"] != user_id:
        raise HTTPException(status_code=401, detail="Xác thực khuôn mặt thất bại")

    # GPS check (optional for checkout)
    if lat is not None and lng is not None:
        loc = db.get_location_config()
        if loc and not is_within_radius(lat, lng, loc["lat"], loc["lng"], loc["radius"]):
            raise HTTPException(status_code=403, detail="Bạn không trong phạm vi cho phép")

    record = db.save_checkout(user_id=user_id, lat=lat, lng=lng)
    return {
        "status":        "success",
        "message":       "Check-out thành công",
        "checkout_time": record["checkout_time"],
    }


# ─────────────────────────────────────────────────────────────────────────────
# REGISTER / UPDATE FACE EMBEDDING
# ─────────────────────────────────────────────────────────────────────────────
@employee_router.post("/register-face")
async def register_face(
    file: UploadFile = File(...),
    current_employee=Depends(get_current_employee),
):
    user_id = current_employee["user_id"]

    emp_key = f"employee:{user_id}"
    if not db.redisDB.exists(emp_key):
        raise HTTPException(status_code=404, detail="Không tìm thấy hồ sơ nhân viên")

    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        raise HTTPException(status_code=400, detail="Ảnh không hợp lệ")

    vector = face_embed.embedding_img(img)
    if vector is None:
        raise HTTPException(
            status_code=422,
            detail="Không nhận diện được khuôn mặt. Đảm bảo khuôn mặt rõ ràng, đủ ánh sáng, nhìn thẳng."
        )

    vector_bytes = np.array(vector, dtype=np.float32).tobytes()
    db.redisDB.hset(emp_key, mapping={
        "vector_embedding":  vector_bytes,
        "biometric_status":  b"pending",  # reset to pending for manager re-approval
    })

    return {
        "status":  "success",
        "message": "Đã cập nhật khuôn mặt, chờ quản lý phê duyệt",
    }


# ─────────────────────────────────────────────────────────────────────────────
# PERSONAL PROFILE
# ─────────────────────────────────────────────────────────────────────────────
@employee_router.get("/profile")
def get_profile(current_employee=Depends(get_current_employee)):
    user_id = current_employee["user_id"]
    emp_key = f"employee:{user_id}"
    data = db.redisDB.hgetall(emp_key)
    if not data:
        raise HTTPException(status_code=404, detail="Không tìm thấy hồ sơ")

    TEXT_FIELDS = {b"user_id", b"name", b"department", b"position",
                   b"email", b"phone", b"biometric_status", b"last_attendance"}
    decoded = {
        k.decode(): v.decode()
        for k, v in data.items()
        if (k if isinstance(k, bytes) else k.encode()) in TEXT_FIELDS
    }
    return decoded


# ─────────────────────────────────────────────────────────────────────────────
# PERSONAL MONTHLY STATS
# ─────────────────────────────────────────────────────────────────────────────
@employee_router.get("/stats/monthly")
def get_monthly_stats(
    year:  int = Query(default=None),
    month: int = Query(default=None),
    current_employee=Depends(get_current_employee),
):
    now = datetime.now()
    year = year or now.year
    month = month or now.month
    if not (1 <= month <= 12):
        raise HTTPException(status_code=400, detail="Tháng không hợp lệ (1–12)")

    user_id = current_employee["user_id"]
    stats = db.get_employee_monthly_stats(user_id, year, month)
    return stats


# ─────────────────────────────────────────────────────────────────────────────
# PERSONAL ATTENDANCE LOG  (by date range)
# ─────────────────────────────────────────────────────────────────────────────
@employee_router.get("/attendance")
def get_personal_attendance(
    start_date: str = Query(..., description="YYYY-MM-DD"),
    end_date:   str = Query(..., description="YYYY-MM-DD"),
    current_employee=Depends(get_current_employee),
):
    user_id = current_employee["user_id"]
    records = db.get_employee_attendance_records(user_id, start_date, end_date)
    return {
        "user_id":    user_id,
        "start_date": start_date,
        "end_date":   end_date,
        "total":      len(records),
        "records":    records,
    }