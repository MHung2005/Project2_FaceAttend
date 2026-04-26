from fastapi import APIRouter, UploadFile, File, Form, Depends
import numpy as np
import cv2
from datetime import datetime
from fastapi import Query
from ..service.embeddings import FaceEmbeddingService
from ..service.storage import StorageService
from ..api.auth import get_current_manager  

db = StorageService()
face_embed = FaceEmbeddingService()
manager_router = APIRouter(prefix="/manager")

@manager_router.post("/employees")
async def create_employee(
    user_id: str = Form(...),
    name: str = Form(...),
    department: str = Form(...),
    position: str = Form(...),
    file: UploadFile = File(...),
    current_manager = Depends(get_current_manager)  
):
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        return {"status": "error", "reason": "Ảnh không hợp lệ"}

    vector = face_embed.embedding_img(img)

    if vector is None:
        return {"status": "error", "reason": "Không tìm thấy khuôn mặt trong ảnh"}

    db.add_face(user_id, name, department, position, vector)

    return {
        "status": "success",
        "message": f"Đã đăng ký khuôn mặt cho {name}"
    }

@manager_router.get("/attendance")
def get_attendance(
    date: str = None,
    current_manager = Depends(get_current_manager)  
):
    if not date:
        date = datetime.now().strftime("%Y-%m-%d")
    records = db.get_checkins_by_date(date)
    return {
        "date": date,
        "total": len(records),
        "records": records
    }

@manager_router.get("/stats")
def get_stats(current_manager=Depends(get_current_manager)):
    today = datetime.now().strftime("%Y-%m-%d")
    today_records = db.get_checkins_by_date(today)
    total_employees = db.get_total_employees()
    checked_in = len(today_records)
    absent = max(0, total_employees - checked_in)
    rate = round((checked_in / total_employees * 100) if total_employees > 0 else 0)
    return {
        "today": checked_in,
        "total": total_employees,
        "absent": absent,
        "rate": rate
    }

@manager_router.get("/stats/weekly")
def get_weekly(current_manager=Depends(get_current_manager)):
    return {"data": db.get_weekly_checkins()}

@manager_router.get("/stats/range")
def get_checkins_range(
    start_date: str = Query(..., description="YYYY-MM-DD"),
    end_date: str = Query(..., description="YYYY-MM-DD"),
    current_manager = Depends(get_current_manager)
):
    """Lấy số điểm danh mỗi ngày trong khoảng thời gian [start_date, end_date]"""
    data = db.get_checkins_by_range(start_date, end_date)
    return {"data": data}