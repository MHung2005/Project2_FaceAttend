from fastapi import APIRouter, UploadFile, File, Form
import numpy as np
import cv2
from ..service.ai.embeddings import FaceEmbeddingService
from ..service.gps_service import is_within_radius
from ..database.storage import StorageService

db = StorageService()
face_embed = FaceEmbeddingService()
guest_router = APIRouter()

@guest_router.post("/checkin")
async def checkin(
    file: UploadFile = File(...),
    lat:  float | None = Form(None),   
    lng:  float | None = Form(None),   
):  
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    # Kiểm tra ảnh hợp lệ
    if img is None:
        return {"status": "error", "reason": "Ảnh không hợp lệ"}

    vector = face_embed.embedding_img(img)

    # Kiểm tra có khuôn mặt không
    if vector is None:
        return {"status": "error", "reason": "Không tìm thấy khuôn mặt"}

    result = db.search_face(vector)

    # Không tìm thấy ai trong DB
    if result is None:
        return {"status": "unsuccess", "reason": "Khuôn mặt chưa được đăng ký"}

    if result['score'] >= 0.85:
        user_id = result['user_id']

        # ── kiểm tra biometric đã được duyệt chưa ──
        emp_data = db.redisDB.hgetall(user_id)
        bio_status = emp_data.get(b"biometric_status", b"approved").decode()
        if bio_status == "pending":
            return {"status": "error", "reason": "Khuôn mặt chưa được duyệt"}
        if bio_status == "rejected":
            return {"status": "error", "reason": "Khuôn mặt bị từ chối, vui lòng đăng ký lại"}

        # ── kiểm tra GPS ──
        gps_ok = True
        if lat is not None and lng is not None:
            loc = db.get_location_config()
            if loc:
                gps_ok = is_within_radius(lat, lng, loc["lat"], loc["lng"], loc["radius"])
                if not gps_ok:
                    return {"status": "error", "reason": "Bạn không trong phạm vi cho phép"}

        if db.is_checked_in_today(user_id):
            return {"status": "already_checked", "reason": "Đã điểm danh hôm nay",
                    "name": result['name']}

        timestamp = db.save_checkin(
            user_id=user_id, name=result['name'],
            department=result['department'], position=result['position'],
            lat=lat, lng=lng, gps_ok=gps_ok  # ← THÊM
        )
        return {"status": "success", "name": result['name'],
                "department": result['department'],
                "position": result['position'], "timestamp": timestamp}
    else:
        return {"status": "unsuccess", "reason": "Không nhận diện được khuôn mặt"}