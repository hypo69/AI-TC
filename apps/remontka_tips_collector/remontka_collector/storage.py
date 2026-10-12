"""
Модуль для работы с локальным JSON-хранилищем советов.
"""

import json
import os
from datetime import datetime
from typing import Any, Dict, List


class JSONStorage:
    """Класс для загрузки и сохранения советов в формате JSON."""

    def __init__(self, filepath: str = "remontka_tips.json"):
        self.filepath = filepath

    def load(self) -> List[Dict[str, Any]]:
        """Загружает список сохраненных советов из JSON-файла."""
        if os.path.exists(self.filepath):
            try:
                with open(self.filepath, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, list):
                        return data
            except (json.JSONDecodeError, OSError) as e:
                print(f"[{datetime.now():%Y-%m-%d %H:%M:%S}] Ошибка чтения {self.filepath}: {e}")
        return []

    def save(self, tips: List[Dict[str, Any]]) -> None:
        """Сохраняет список советов в JSON-файл с кодировкой UTF-8."""
        try:
            with open(self.filepath, "w", encoding="utf-8") as f:
                json.dump(tips, f, ensure_ascii=False, indent=4)
        except OSError as e:
            print(f"[{datetime.now():%Y-%m-%d %H:%M:%S}] Ошибка записи в {self.filepath}: {e}")
