"""
Модуль сетевых запросов для получения RSS-лент.
"""

import urllib.request
from typing import Optional


class RSSFetcher:
    """Загрузчик RSS XML контента."""

    def __init__(self, user_agent: str = "Mozilla/5.0"):
        self.user_agent = user_agent

    def fetch(self, url: str, timeout: int = 15) -> Optional[bytes]:
        """Получает сырые данные RSS по указанному URL."""
        req = urllib.request.Request(url, headers={"User-Agent": self.user_agent})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as response:
                return response.read()
        except Exception as e:
            print(f"Ошибка при загрузке RSS с {url}: {e}")
            return None
