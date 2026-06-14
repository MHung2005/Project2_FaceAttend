import redis
import numpy as np
from redis.commands.search.field import VectorField, TextField
from redis.commands.search.query import Query
from redis.commands.search.index_definition import IndexDefinition, IndexType
from redis.exceptions import ResponseError
from datetime import datetime, timedelta


class StorageService:
    def __init__(self, host='localhost', port=6379):
        self.redisDB = redis.Redis(host=host, port=port, decode_responses=False)
        self.nameDB = "store_faces"
        self.vector_dim = 512
        self._create_index()

    # ─────────────────────────────────────────────────────────────
    # INDEX
    # ─────────────────────────────────────────────────────────────
    def _create_index(self):
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
            idx_def_raw = info.get(b"index_definition", info.get("index_definition", []))
            if isinstance(idx_def_raw, list):
                idx_def = dict(zip(idx_def_raw[::2], idx_def_raw[1::2]))
            elif isinstance(idx_def_raw, dict):
                idx_def = idx_def_raw
            else:
                idx_def = {}
            prefixes = idx_def.get(b"prefixes", idx_def.get("prefixes", []))
            decoded_prefixes = [p.decode() if isinstance(p, bytes) else p for p in prefixes]
            if "employee:" not in decoded_prefixes:
                print("⚠️ Index cũ sai cấu hình prefix, đang tạo lại...")
                self.redisDB.ft(self.nameDB).dropindex(dd=False)
                index_exists = False
        except ResponseError as e:
            if "Unknown index name" in str(e) or "no such index" in str(e).lower():
                index_exists = False
            else:
                raise

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

    # ─────────────────────────────────────────────────────────────
    # EMPLOYEE FACE / RECORD
    # ─────────────────────────────────────────────────────────────
    def add_face(self, user_id: str, name: str, department: str, position: str, vector):
        vector_bytes = np.array(vector, dtype=np.float32).tobytes()
        key = f"employee:{user_id}"
        self.redisDB.hset(key, mapping={
            "user_id":          user_id.encode(),
            "name":             name.encode(),
            "department":       department.encode(),
            "position":         position.encode(),
            "biometric_status": b"pending",
            "vector_embedding": vector_bytes,
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
            "user_id":    doc.user_id.decode() if isinstance(doc.user_id, bytes) else doc.user_id,
            "name":       doc.name.decode() if isinstance(doc.name, bytes) else doc.name,
            "department": doc.department.decode() if isinstance(doc.department, bytes) else doc.department,
            "position":   doc.position.decode() if isinstance(doc.position, bytes) else doc.position,
            "score":      1 - float(doc.score),
        }

    def get_all_employees(self) -> list:
        TEXT_FIELDS = {b"user_id", b"name", b"department", b"position",
                       b"last_attendance", b"biometric_status", b"email",
                       b"phone", b"username"}
        employees = []
        for key in self.redisDB.scan_iter("employee:*"):
            try:
                data = self.redisDB.hgetall(key)
                if not data:
                    continue
                decoded = {}
                for k, v in data.items():
                    field_name = k if isinstance(k, bytes) else k.encode()
                    if field_name in TEXT_FIELDS:
                        decoded[k.decode() if isinstance(k, bytes) else k] = (
                            v.decode() if isinstance(v, bytes) else v
                        )
                if "user_id" not in decoded:
                    continue
                employees.append({
                    "user_id":          decoded.get("user_id", ""),
                    "name":             decoded.get("name", ""),
                    "department":       decoded.get("department", ""),
                    "position":         decoded.get("position", ""),
                    "email":            decoded.get("email", ""),
                    "phone":            decoded.get("phone", ""),
                    "biometric_status": decoded.get("biometric_status", "pending"),
                    "last_attendance":  decoded.get("last_attendance", ""),
                })
            except Exception as e:
                print(f"[get_all_employees] Lỗi key '{key}': {e}")
        return employees

    def delete_employee(self, user_id: str) -> bool:
        try:
            deleted = self.redisDB.delete(f"employee:{user_id}")
            return deleted > 0
        except Exception:
            return False

    def update_employee(self, user_id: str, name: str, department: str, position: str) -> bool:
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

    def bulk_create_employees(self, employees: list) -> dict:
        """
        Create multiple employee records from parsed Excel/CSV data.
        Each item: {user_id, name, email, phone, department, position}
        Returns {created, skipped, errors}
        """
        created, skipped, errors = [], [], []
        for emp in employees:
            user_id = emp.get("user_id", "").strip()
            name = emp.get("name", "").strip()
            if not user_id or not name:
                errors.append({"row": emp, "reason": "Thiếu user_id hoặc tên"})
                continue
            key = f"employee:{user_id}"
            if self.redisDB.exists(key):
                skipped.append(user_id)
                continue
            try:
                mapping = {
                    "user_id":          user_id.encode(),
                    "name":             name.encode(),
                    "department":       emp.get("department", "").encode(),
                    "position":         emp.get("position", "").encode(),
                    "email":            emp.get("email", "").encode(),
                    "phone":            emp.get("phone", "").encode(),
                    "biometric_status": b"pending",
                }
                self.redisDB.hset(key, mapping=mapping)
                # also store login index if username/password provided
                username = emp.get("username", "").strip()
                hashed_pw = emp.get("hashed_password", "")
                if username and hashed_pw:
                    self.redisDB.hset(key, mapping={
                        "username": username.encode(),
                        "password": hashed_pw.encode(),
                        "role":     b"employee",
                    })
                    self.redisDB.set(f"emp_login:{username}", user_id.encode())
                created.append(user_id)
            except Exception as e:
                errors.append({"row": emp, "reason": str(e)})
        return {"created": created, "skipped": skipped, "errors": errors}

    # ─────────────────────────────────────────────────────────────
    # ATTENDANCE — CHECK-IN
    # ─────────────────────────────────────────────────────────────
    def _get_checkin_status(self, now: datetime) -> str:
        """Return 'Đúng giờ' or 'Đi muộn' based on schedule config."""
        cfg = self.get_schedule_config()
        start_h, start_m = map(int, cfg["start_time"].split(":"))
        grace = int(cfg.get("grace_minutes", 0))
        deadline = now.replace(hour=start_h, minute=start_m + grace, second=0, microsecond=0)
        return "Đúng giờ" if now <= deadline else "Đi muộn"

    def save_checkin(self, user_id, name, department, position,
                     lat=None, lng=None, gps_ok=False):
        today = datetime.now().strftime("%Y-%m-%d")
        now = datetime.now()
        timestamp = now.strftime("%Y-%m-%d %H:%M:%S")
        status = self._get_checkin_status(now)
        key = f"checkin:{today}:{user_id}"
        self.redisDB.hset(key, mapping={
            "user_id":    user_id.encode(),
            "name":       name.encode(),
            "department": department.encode(),
            "position":   position.encode(),
            "timestamp":  timestamp.encode(),
            "lat":        str(lat or "").encode(),
            "lng":        str(lng or "").encode(),
            "gps_ok":     (b"true" if gps_ok else b"false"),
            "status":     status.encode(),   # Đúng giờ / Đi muộn
        })
        self.redisDB.expire(key, 60 * 60 * 24 * 90)
        # update last_attendance on employee record
        self.redisDB.hset(f"employee:{user_id}", "last_attendance", today.encode())
        return timestamp, status

    def is_checked_in_today(self, user_id: str) -> bool:
        today = datetime.now().strftime("%Y-%m-%d")
        return self.redisDB.exists(f"checkin:{today}:{user_id}") == 1

    # ─────────────────────────────────────────────────────────────
    # ATTENDANCE — CHECK-OUT
    # ─────────────────────────────────────────────────────────────
    def save_checkout(self, user_id: str, lat=None, lng=None) -> dict | None:
        """
        Record checkout time on today's checkin record.
        Returns updated record or None if no checkin found.
        """
        today = datetime.now().strftime("%Y-%m-%d")
        key = f"checkin:{today}:{user_id}"
        if not self.redisDB.exists(key):
            return None
        checkout_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.redisDB.hset(key, mapping={
            "checkout_time":    checkout_time.encode(),
            "checkout_lat":     str(lat or "").encode(),
            "checkout_lng":     str(lng or "").encode(),
        })
        return {"checkout_time": checkout_time}

    def is_checked_out_today(self, user_id: str) -> bool:
        today = datetime.now().strftime("%Y-%m-%d")
        key = f"checkin:{today}:{user_id}"
        data = self.redisDB.hgetall(key)
        return b"checkout_time" in data

    # ─────────────────────────────────────────────────────────────
    # ATTENDANCE QUERIES
    # ─────────────────────────────────────────────────────────────
    def get_checkins_by_date(self, date: str) -> list:
        pattern = f"checkin:{date}:*"
        records = []
        for key in self.redisDB.scan_iter(pattern):
            data = self.redisDB.hgetall(key)
            records.append({k.decode(): v.decode() for k, v in data.items()})
        records.sort(key=lambda x: x.get("timestamp", ""))
        return records

    def get_checkins_by_range(self, start_date: str, end_date: str) -> list:
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
            result.append({"date": date_str, "label": day.strftime("%a"), "count": count})
            day += timedelta(days=1)
        return result

    def get_weekly_checkins(self) -> list:
        result = []
        today = datetime.now()
        for i in range(6, -1, -1):
            day = today - timedelta(days=i)
            date_str = day.strftime("%Y-%m-%d")
            count = sum(1 for _ in self.redisDB.scan_iter(f"checkin:{date_str}:*"))
            result.append({"date": date_str, "label": day.strftime("%a"), "count": count})
        return result

    def get_total_employees(self) -> int:
        return len(self.get_all_employees())

    # ─────────────────────────────────────────────────────────────
    # EMPLOYEE PERSONAL STATS
    # ─────────────────────────────────────────────────────────────
    def get_employee_monthly_stats(self, user_id: str, year: int, month: int) -> dict:
        """
        Return attendance summary for a specific employee in a given month.
        {total_days, present, late, absent, records}
        """
        from calendar import monthrange
        total_days = monthrange(year, month)[1]
        today = datetime.now().date()

        records = []
        on_time = 0
        late = 0

        for d in range(1, total_days + 1):
            day_date = datetime(year, month, d).date()
            if day_date > today:
                break  # future days not counted
            date_str = day_date.strftime("%Y-%m-%d")
            key = f"checkin:{date_str}:{user_id}"
            data = self.redisDB.hgetall(key)
            if data:
                decoded = {k.decode(): v.decode() for k, v in data.items()}
                status = decoded.get("status", "Đúng giờ")
                if status == "Đi muộn":
                    late += 1
                else:
                    on_time += 1
                records.append({
                    "date":          date_str,
                    "timestamp":     decoded.get("timestamp", ""),
                    "checkout_time": decoded.get("checkout_time", ""),
                    "status":        status,
                    "gps_ok":        decoded.get("gps_ok", "false"),
                })
            else:
                records.append({"date": date_str, "status": "Vắng mặt"})

        present = on_time + late
        elapsed = len([r for r in records if r["status"] != "Vắng mặt" or r["date"] <= today.strftime("%Y-%m-%d")])
        absent = max(0, min(today.day if (year, month) == (today.year, today.month) else total_days, total_days) - present)

        return {
            "year":       year,
            "month":      month,
            "total_days": total_days,
            "present":    present,
            "on_time":    on_time,
            "late":       late,
            "absent":     absent,
            "records":    records,
        }

    def get_employee_attendance_records(self, user_id: str, start_date: str, end_date: str) -> list:
        """Fetch attendance records for a single employee in a date range."""
        try:
            start = datetime.strptime(start_date, "%Y-%m-%d")
            end = datetime.strptime(end_date, "%Y-%m-%d")
        except Exception:
            return []
        records = []
        day = start
        while day <= end:
            date_str = day.strftime("%Y-%m-%d")
            key = f"checkin:{date_str}:{user_id}"
            data = self.redisDB.hgetall(key)
            if data:
                decoded = {k.decode(): v.decode() for k, v in data.items()}
                records.append({
                    "date":          date_str,
                    "timestamp":     decoded.get("timestamp", ""),
                    "checkout_time": decoded.get("checkout_time", ""),
                    "status":        decoded.get("status", "Đúng giờ"),
                    "gps_ok":        decoded.get("gps_ok", "false"),
                    "lat":           decoded.get("lat", ""),
                    "lng":           decoded.get("lng", ""),
                })
            day += timedelta(days=1)
        return records

    # ─────────────────────────────────────────────────────────────
    # MANAGER ANALYTICS
    # ─────────────────────────────────────────────────────────────
    def get_daily_analytics(self, date: str = None) -> dict:
        """
        Return {total_employees, present, on_time, late, absent, records}
        where records include each employee's status for the day.
        """
        if not date:
            date = datetime.now().strftime("%Y-%m-%d")

        all_employees = self.get_all_employees()
        total = len(all_employees)

        checkin_map = {}  # user_id -> record
        for key in self.redisDB.scan_iter(f"checkin:{date}:*"):
            data = self.redisDB.hgetall(key)
            decoded = {k.decode(): v.decode() for k, v in data.items()}
            uid = decoded.get("user_id", "")
            if uid:
                checkin_map[uid] = decoded

        present = len(checkin_map)
        on_time = sum(1 for r in checkin_map.values() if r.get("status") == "Đúng giờ")
        late = sum(1 for r in checkin_map.values() if r.get("status") == "Đi muộn")
        absent = max(0, total - present)

        records = []
        for emp in all_employees:
            uid = emp["user_id"]
            if uid in checkin_map:
                r = checkin_map[uid]
                records.append({
                    **emp,
                    "checkin_time":  r.get("timestamp", ""),
                    "checkout_time": r.get("checkout_time", ""),
                    "status":        r.get("status", "Đúng giờ"),
                    "gps_ok":        r.get("gps_ok", "false"),
                })
            else:
                records.append({**emp, "checkin_time": "", "checkout_time": "", "status": "Vắng mặt", "gps_ok": "false"})

        return {
            "date":             date,
            "total_employees":  total,
            "present":          present,
            "on_time":          on_time,
            "late":             late,
            "absent":           absent,
            "records":          records,
        }

    # ─────────────────────────────────────────────────────────────
    # AUTH — MANAGER
    # ─────────────────────────────────────────────────────────────
    def save_manager(self, username: str, hashed_password: str):
        key = f"manager:{username}"
        self.redisDB.hset(key, mapping={
            "username": username.encode(),
            "password": hashed_password.encode(),
            "role":     b"manager",
        })

    def get_manager(self, username: str) -> dict | None:
        key = f"manager:{username}"
        if not self.redisDB.exists(key):
            return None
        data = self.redisDB.hgetall(key)
        return {k.decode(): v.decode() for k, v in data.items()}

    # ─────────────────────────────────────────────────────────────
    # AUTH — EMPLOYEE
    # ─────────────────────────────────────────────────────────────
    def save_employee_account(self, user_id: str, username: str, hashed_pw: str):
        key = f"employee:{user_id}"
        self.redisDB.hset(key, mapping={
            "username": username.encode(),
            "password": hashed_pw.encode(),
            "user_id":  user_id.encode(),
            "role":     b"employee",
        })
        self.redisDB.set(f"emp_login:{username}", user_id.encode())

    def get_employee_account(self, username: str) -> dict | None:
        key = f"emp_login:{username}"
        user_id = self.redisDB.get(key)
        if not user_id:
            return None
        data = self.redisDB.hgetall(f"employee:{user_id.decode()}")
        return {k.decode(): v.decode() for k, v in data.items()}

    # ─────────────────────────────────────────────────────────────
    # BIOMETRIC APPROVAL
    # ─────────────────────────────────────────────────────────────
    def approve_biometric(self, user_id: str, status: str) -> bool:
        key = f"employee:{user_id}"
        if not self.redisDB.exists(key):
            return False
        self.redisDB.hset(key, "biometric_status", status.encode())
        return True

    def get_pending_employees(self) -> list:
        employees = self.get_all_employees()
        return [e for e in employees if e.get("biometric_status") == "pending"]

    # ─────────────────────────────────────────────────────────────
    # LOCATION CONFIG
    # ─────────────────────────────────────────────────────────────
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

    # ─────────────────────────────────────────────────────────────
    # SCHEDULE CONFIG (start time, grace period)
    # ─────────────────────────────────────────────────────────────
    def set_schedule_config(self, start_time: str, end_time: str, grace_minutes: int = 0):
        """start_time / end_time in "HH:MM" format."""
        self.redisDB.hset("schedule:config", mapping={
            "start_time":     start_time.encode(),
            "end_time":       end_time.encode(),
            "grace_minutes":  str(grace_minutes).encode(),
        })

    def get_schedule_config(self) -> dict:
        data = self.redisDB.hgetall("schedule:config")
        if not data:
            return {"start_time": "08:00", "end_time": "17:00", "grace_minutes": "0"}
        return {k.decode(): v.decode() for k, v in data.items()}