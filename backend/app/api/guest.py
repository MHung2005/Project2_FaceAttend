from fastapi import APIRouter, UploadFile, File
import numpy as np
import cv2
from ..service.embeddings import FaceEmbeddingService
from ..service.storage import StorageService

db = StorageService()
face_embed = FaceEmbeddingService()
guest_router = APIRouter()

@guest_router.post("/checkin")
async def checkin(file: UploadFile = File(...)):
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

        # Kiểm tra đã điểm danh hôm nay chưa
        if db.is_checked_in_today(user_id):
            return {
                "status": "already_checked",
                "reason": "Bạn đã điểm danh hôm nay rồi",
                "name": result['name']
            }

        # Lưu điểm danh + trả về timestamp
        timestamp = db.save_checkin(
            user_id=user_id,
            name=result['name'],
            department=result['department'],
            position=result['position']
        )

        return {
            "status": "success",
            "name": result['name'],
            "department": result['department'],
            "position": result['position'],
            "timestamp": timestamp
        }
    else:
        return {"status": "unsuccess", "reason": "Không nhận diện được khuôn mặt"}