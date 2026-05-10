import redis
import numpy as np
from redis.commands.search.field import VectorField, TextField
from redis.commands.search.query import Query
from datetime import datetime

class StorageService:
    def __init__(self, host='localhost', port=6379):
        self.redisDB = redis.Redis(host=host, port=port, decode_responses=False)
        self.nameDB = "store_faces"
        self.vector_dim = 512
        self._create_index()

    def _create_index(self):
        try:
            self.redisDB.ft(self.nameDB).info()
        except:
            schema = (
                TextField("user_id"),
                TextField("name"),
                TextField("department"),
                TextField("position"),
                VectorField("vector_embedding", "HNSW", {
                    "TYPE": "FLOAT32",
                    "DIM": self.vector_dim,
                    "DISTANCE_METRIC": "COSINE"
                })
            )
            self.redisDB.ft(self.nameDB).create_index(fields=schema)

    def add_face(self, user_id, name, department, position, vector):
        vector_bytes = np.array(vector, dtype=np.float32).tobytes()

        self.redisDB.hset(user_id, mapping={
            "user_id": user_id.encode(),
            "name": name.encode(),
            "department": department.encode(),
            "position": position.encode(),
            "vector_embedding": vector_bytes
        })
        print(f"Đã lưu: {name}")

    def search_face(self, query_vector, top_k=1):
        vector_bytes = np.array(query_vector, dtype=np.float32).tobytes()

        q = (Query(f"*=>[KNN {top_k} @vector_embedding $vector_param AS score]")
             .sort_by("score")
             .return_fields("user_id", "name", "department", "position", "score")
             .dialect(2))

        params = {"vector_param": vector_bytes}
        results = self.redisDB.ft(self.nameDB).search(q, params)

        if not results.docs:
            return None

        doc = results.docs[0]
        return {
            "user_id": doc.user_id.decode() if isinstance(doc.user_id, bytes) else doc.user_id,
            "name": doc.name.decode() if isinstance(doc.name, bytes) else doc.name,
            "department": doc.department.decode() if isinstance(doc.department, bytes) else doc.department,
            "position": doc.position.decode() if isinstance(doc.position, bytes) else doc.position,
            "score": 1 - float(doc.score)
        }

    def save_checkin(self, user_id, name, department, position):
        today = datetime.now().strftime("%Y-%m-%d")
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        key = f"checkin:{today}:{user_id}"
        self.redisDB.hset(key, mapping={
            "user_id": user_id.encode(),
            "name": name.encode(),
            "department": department.encode(),
            "position": position.encode(),
            "timestamp": timestamp.encode()
        })
        self.redisDB.expire(key, 60 * 60 * 24 * 7)
        return timestamp

    def is_checked_in_today(self, user_id):
        today = datetime.now().strftime("%Y-%m-%d")
        key = f"checkin:{today}:{user_id}"
        return self.redisDB.exists(key) == 1

    def get_checkins_by_date(self, date: str):
        pattern = f"checkin:{date}:*"
        keys = self.redisDB.keys(pattern)
        records = []
        for key in keys:
            data = self.redisDB.hgetall(key)
            records.append({
                k.decode(): v.decode() for k, v in data.items()
            })
        records.sort(key=lambda x: x.get("timestamp", ""))
        return records

    def save_manager(self, username: str, hashed_password: str):
        key = f"manager:{username}"
        self.redisDB.hset(key, mapping={
            "username": username.encode(),
            "password": hashed_password.encode(),
            "role": b"manager"
        })

    def get_manager(self, username: str) -> dict | None:
        key = f"manager:{username}"
        if not self.redisDB.exists(key):
            return None
        data = self.redisDB.hgetall(key)
        return {
            k.decode(): v.decode() for k, v in data.items()
        }

    def get_total_employees(self) -> int:
        """
        Đếm tổng số nhân viên đã đăng ký.
        Dùng get_all_employees() để đảm bảo nhất quán,
        không hardcode prefix key.
        """
        return len(self.get_all_employees())

    def get_weekly_checkins(self) -> list:
        """Lấy số điểm danh 7 ngày gần nhất"""
        from datetime import timedelta
        result = []
        today = datetime.now()
        for i in range(6, -1, -1):
            day = today - timedelta(days=i)
            date_str = day.strftime("%Y-%m-%d")
            keys = self.redisDB.keys(f"checkin:{date_str}:*")
            result.append({
                "date": date_str,
                "label": day.strftime("%a"),
                "count": len(keys)
            })
        return result

    def get_checkins_by_range(self, start_date: str, end_date: str) -> list:
        """Lấy số điểm danh mỗi ngày trong khoảng [start_date, end_date] (YYYY-MM-DD)"""
        from datetime import datetime, timedelta
        try:
            start = datetime.strptime(start_date, "%Y-%m-%d")
            end = datetime.strptime(end_date, "%Y-%m-%d")
        except Exception:
            return []
        if start > end:
            return []
        result = []
        day = start
        while day <= end:
            date_str = day.strftime("%Y-%m-%d")
            keys = self.redisDB.keys(f"checkin:{date_str}:*")
            result.append({
                "date": date_str,
                "label": day.strftime("%a"),
                "count": len(keys)
            })
            day += timedelta(days=1)
        return result

    def get_all_employees(self) -> list:
        """
        Lấy toàn bộ danh sách nhân viên đã đăng ký.
        """
        TEXT_FIELDS = {b"user_id", b"name", b"department", b"position"}

        all_keys = self.redisDB.keys("*")
        employees = []

        for key in all_keys:
            key_str = key.decode() if isinstance(key, bytes) else key

            # Bỏ qua các key hệ thống
            if key_str.startswith("checkin:") or key_str.startswith("manager:"):
                continue

            # Bỏ qua Redis Search internal keys
            if key_str.startswith("idx:") or key_str.startswith("store_faces"):
                continue

            try:
                data = self.redisDB.hgetall(key)
                if not data:
                    continue

                # Chỉ decode text fields, bỏ qua vector_embedding (binary)
                decoded = {}
                for k, v in data.items():
                    field_name = k if isinstance(k, bytes) else k.encode()
                    if field_name in TEXT_FIELDS:
                        decoded[k.decode() if isinstance(k, bytes) else k] = (
                            v.decode() if isinstance(v, bytes) else v
                        )

                # Chỉ lấy record có đủ field user_id (là employee record thật)
                if "user_id" not in decoded:
                    continue

                last_checkin = self._get_last_checkin(decoded["user_id"])

                employees.append({
                    "user_id":          decoded.get("user_id", ""),
                    "name":             decoded.get("name", ""),
                    "department":       decoded.get("department", ""),
                    "position":         decoded.get("position", ""),
                    "biometric_status": "registered",
                    "last_attendance":  last_checkin,
                })
            except Exception as e:
                print(f"[get_all_employees] Lỗi khi xử lý key '{key_str}': {e}")
                continue

        return employees

    def _get_last_checkin(self, user_id: str) -> str:
        """Lấy timestamp điểm danh gần nhất của nhân viên"""
        pattern = f"checkin:*:{user_id}"
        keys = self.redisDB.keys(pattern)
        if not keys:
            return ""

        latest = ""
        for key in keys:
            data = self.redisDB.hgetall(key)
            ts = data.get(b"timestamp", b"").decode()
            if ts > latest:
                latest = ts
        return latest

    def delete_employee(self, user_id: str) -> bool:
        """Xóa nhân viên khỏi hệ thống"""
        try:
            deleted = self.redisDB.delete(user_id)
            return deleted > 0
        except Exception:
            return False

    def update_employee(self, user_id: str, name: str,
                        department: str, position: str) -> bool:
        """Cập nhật thông tin nhân viên (không thay đổi vector)"""
        try:
            if not self.redisDB.exists(user_id):
                return False
            self.redisDB.hset(user_id, mapping={
                "name":       name.encode(),
                "department": department.encode(),
                "position":   position.encode(),
            })
            return True
        except Exception:
            return False