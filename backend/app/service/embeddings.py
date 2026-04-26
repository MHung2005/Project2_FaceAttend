import numpy as np
from insightface.app import FaceAnalysis

"""
    Sử dụng InsightFace embedding ảnh
"""

class FaceEmbeddingService:
    def __init__(self):
        self.app = FaceAnalysis(name='buffalo_l')
        self.app.prepare(ctx_id=-1, det_size=(640, 640))

    def embedding_img(self, img):
        faces = self.app.get(img)

        if not faces:
            print(f"Không tìm thấy khuôn mặt nào")
            return None
        
        best_face = max(faces, key=lambda x: x.det_score)

        embed_vector = best_face.embedding

        return embed_vector
       
