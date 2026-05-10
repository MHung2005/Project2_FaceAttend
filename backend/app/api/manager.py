from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from pydantic import BaseModel
import numpy as np
import cv2
from datetime import datetime
from fastapi import Query
from ..service.ai.embeddings import FaceEmbeddingService
from ..database.storage import StorageService
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
        # HTTP 400 → axios sẽ throw → frontend bắt được trong catch
        raise HTTPException(status_code=400, detail="Ảnh không hợp lệ")

    vector = face_embed.embedding_img(img)

    if vector is None:
        # Có thể do: không phát hiện khuôn mặt, keypoint không đủ, ảnh mờ/tối
        raise HTTPException(
            status_code=422,
            detail="Không thể nhận diện khuôn mặt. Vui lòng đảm bảo khuôn mặt rõ ràng, đủ ánh sáng và nhìn thẳng vào camera."
        )

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
    data = db.get_checkins_by_range(start_date, end_date)
    return {"data": data}

@manager_router.get("/employees")
def list_employees(current_manager=Depends(get_current_manager)):
    employees = db.get_all_employees()
    return {
        "total": len(employees),
        "employees": employees
    }

@manager_router.delete("/employees/{user_id}")
def delete_employee(
    user_id: str,
    current_manager=Depends(get_current_manager)
):
    success = db.delete_employee(user_id)
    if not success:
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
    current_manager=Depends(get_current_manager)
):
    success = db.update_employee(
        user_id, body.name, body.department, body.position
    )
    if not success:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhân viên")
    return {"status": "success", "message": "Đã cập nhật thông tin"}