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
        from redis.commands.search.index_definition import IndexDefinition, IndexType
        from redis.exceptions import ResponseError

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

        index_exists = False
        try:
            info = self.redisDB.ft(self.nameDB).info()
            index_exists = True

            # Redis 7.x trả về info dạng dict với key là bytes hoặc string,
            # trong đó index_definition là list flat [b'key', b'value', ...]
            idx_def_raw = info.get(b"index_definition", info.get("index_definition", []))

            # Chuyển list flat thành dict nếu cần
            if isinstance(idx_def_raw, list):
                idx_def = dict(zip(idx_def_raw[::2], idx_def_raw[1::2]))
            elif isinstance(idx_def_raw, dict):
                idx_def = idx_def_raw
            else:
                idx_def = {}

            # Lấy prefixes, hỗ trợ cả key bytes lẫn string
            prefixes = idx_def.get(b"prefixes", idx_def.get("prefixes", []))
            decoded_prefixes = [
                p.decode() if isinstance(p, bytes) else p for p in prefixes
            ]

            if "employee:" not in decoded_prefixes:
                print("⚠️ Index cũ sai cấu hình prefix, đang tạo lại...")
                self.redisDB.ft(self.nameDB).dropindex(dd=False)
                index_exists = False  # Sẽ tạo lại bên dưới

        except ResponseError as e:
            if "Unknown index name" in str(e) or "no such index" in str(e).lower():
                index_exists = False  # Index chưa tồn tại → tạo mới
            else:
                raise  # Lỗi khác thì propagate

        if not index_exists:
            try:
                self.redisDB.ft(self.nameDB).create_index(
                    fields=schema,
                    definition=IndexDefinition(prefix=["employee:"], index_type=IndexType.HASH)
                )
                print("✅ Đã khởi tạo thành công chỉ mục Redis Search.")
            except ResponseError as e:
                if "Index already exists" in str(e):
                    print("✅ Index đã tồn tại, bỏ qua.")
                else:
                    raise
        else:
            print("✅ Index hợp lệ, tiếp tục sử dụng.")
    

    def add_face(self, user_id, name, department, position, vector):
        vector_bytes = np.array(vector, dtype=np.float32).tobytes()
        self.redisDB.hset(user_id, mapping={
            "user_id":           user_id.encode(),
            "name":              name.encode(),
            "department":        department.encode(),
            "position":          position.encode(),
            "biometric_status":  b"pending",   
            "vector_embedding":  vector_bytes
    })

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

    def save_checkin(self, user_id, name, department, position, lat=None, lng=None, gps_ok=False):  
        today = datetime.now().strftime("%Y-%m-%d")
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        key = f"checkin:{today}:{user_id}"
        self.redisDB.hset(key, mapping={
            "user_id":    user_id.encode(),
            "name":       name.encode(),
            "department": department.encode(),
            "position":   position.encode(),
            "timestamp":  timestamp.encode(),
            "lat":        str(lat or "").encode(),   # ← THÊM
            "lng":        str(lng or "").encode(),   # ← THÊM
            "gps_ok":     (b"true" if gps_ok else b"false"),  # ← THÊM
        })
        self.redisDB.expire(key, 60 * 60 * 24 * 7)
        return timestamp

    def is_checked_in_today(self, user_id):
        today = datetime.now().strftime("%Y-%m-%d")
        key = f"checkin:{today}:{user_id}"
        return self.redisDB.exists(key) == 1

    def get_checkins_by_date(self, date: str):
        pattern = f"checkin:{date}:*"
        records = []
        for key in self.redisDB.scan_iter(pattern):
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
            count = sum(1 for _ in self.redisDB.scan_iter(f"checkin:{date_str}:*"))
            result.append({
                "date": date_str,
                "label": day.strftime("%a"),
                "count": count
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
            count = sum(1 for _ in self.redisDB.scan_iter(f"checkin:{date_str}:*"))
            result.append({
                "date": date_str,
                "label": day.strftime("%a"),
                "count": count
            })
            day += timedelta(days=1)
        return result

    def get_all_employees(self) -> list:
        """
        Lấy toàn bộ danh sách nhân viên đã đăng ký.
        """
        TEXT_FIELDS = {b"user_id", b"name", b"department", b"position", b"last_attendance"}
        employees = []

        for key in self.redisDB.scan_iter("employee:*"):
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

                employees.append({
                    "user_id":          decoded.get("user_id", ""),
                    "name":             decoded.get("name", ""),
                    "department":       decoded.get("department", ""),
                    "position":         decoded.get("position", ""),
                    "biometric_status": "registered",
                    "last_attendance":  decoded.get("last_attendance", ""),
                })
            except Exception as e:
                key_str = key.decode() if isinstance(key, bytes) else key
                print(f"[get_all_employees] Lỗi khi xử lý key '{key_str}': {e}")
                continue

        return employees

    def delete_employee(self, user_id: str) -> bool:
        """Xóa nhân viên khỏi hệ thống"""
        try:
            deleted = self.redisDB.delete(f"employee:{user_id}")
            return deleted > 0
        except Exception:
            return False

    def update_employee(self, user_id: str, name: str,
                        department: str, position: str) -> bool:
        """Cập nhật thông tin nhân viên (không thay đổi vector)"""
        try:
            key = f"employee:{user_id}"
            if not self.redisDB.exists(key):
                return False
            self.redisDB.hset(key, mapping={
                "name":       name.encode(),
                "department": department.encode(),
                "position":   position.encode(),
            })
            return True
        except Exception:
            return False

    def save_employee_account(self, user_id: str, username: str, hashed_pw: str):
        key = f"employee:{user_id}"
        self.redisDB.hset(key, mapping={
            "username":  username.encode(),
            "password":  hashed_pw.encode(),
            "user_id":   user_id.encode(),
            "role":      b"employee",
        })

    def get_employee_account(self, username: str) -> dict | None:
        # Scan vì username không phải key — hoặc tạo index user:username→id
        # Cách đơn giản nhất: lưu thêm key "emp_login:{username}" -> user_id
        key = f"emp_login:{username}"
        user_id = self.redisDB.get(key)
        if not user_id:
            return None
        data = self.redisDB.hgetall(f"employee:{user_id.decode()}")
        return {k.decode(): v.decode() for k, v in data.items()}

    def approve_biometric(self, user_id: str, status: str) -> bool:
        # status: "approved" | "rejected"
        if not self.redisDB.exists(user_id):
            return False
        self.redisDB.hset(user_id, "biometric_status", status.encode())
        return True

    def get_pending_employees(self) -> list:
        employees = self.get_all_employees()
        return [e for e in employees if e.get("biometric_status") == "pending"]

    def set_location_config(self, lat: float, lng: float, radius: float):
        self.redisDB.hset("location:config", mapping={
            "lat":    str(lat).encode(),
            "lng":    str(lng).encode(),
            "radius": str(radius).encode(),
        })

    def get_location_config(self) -> dict | None:
        data = self.redisDB.hgetall("location:config")
        if not data:
            return None
        return {k.decode(): float(v.decode()) for k, v in data.items()}