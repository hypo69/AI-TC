"""
Основной класс сбора и фильтрации советов.
"""

import time
from datetime import datetime
from typing import Any, Dict, List

from .config import DEFAULT_INTERVAL_SECONDS, DEFAULT_JSON_FILE, DEFAULT_RSS_URL
from .fetcher import RSSFetcher
from .parser import RSSParser
from .storage import JSONStorage


class TipsCollector:
    """Оркестратор периодического сбора советов без дубликатов."""

    def __init__(
        self,
        rss_url: str = DEFAULT_RSS_URL,
        json_file: str = DEFAULT_JSON_FILE,
        fetch_timeout: int = 15,
    ):
        self.rss_url = rss_url
        self.storage = JSONStorage(json_file)
        self.fetcher = RSSFetcher()
        self.parser = RSSParser()
        self.fetch_timeout = fetch_timeout

    def collect_once(self) -> int:
        """
        Выполняет один итерационный шаг сбора советов.
        Возвращает количество добавленных новых советов.
        """
        saved_tips = self.storage.load()
        existing_links = {
            item.get("link")
            for item in saved_tips
            if isinstance(item, dict) and "link" in item
        }

        xml_data = self.fetcher.fetch(self.rss_url, timeout=self.fetch_timeout)
        if not xml_data:
            print(f"[{datetime.now():%Y-%m-%d %H:%M:%S}] Не удалось загрузить RSS данные.")
            return 0

        fetched_items = self.parser.parse_feed(xml_data)
        new_count = 0

        # Обработка от старых к новым публикациям
        for item in reversed(fetched_items):
            link = item.get("link")
            if link and link not in existing_links:
                entry = {
                    "id": link,
                    "title": item["title"],
                    "description": item["description"],
                    "link": link,
                    "added_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                }
                saved_tips.append(entry)
                existing_links.add(link)
                new_count += 1
                print(
                    f"[{datetime.now():%Y-%m-%d %H:%M:%S}] Новый совет: {item['title']}"
                )

        if new_count > 0:
            self.storage.save(saved_tips)
            print(
                f"[{datetime.now():%Y-%m-%d %H:%M:%S}] Сохранено новых записей: {new_count}"
            )
        else:
            print(
                f"[{datetime.now():%Y-%m-%d %H:%M:%S}] Новых советов не обнаружено."
            )

        return new_count

    def run_periodic(self, interval_seconds: int = DEFAULT_INTERVAL_SECONDS) -> None:
        """Запускает бесконечный цикл периодического сбора."""
        print(
            f"[{datetime.now():%Y-%m-%d %H:%M:%S}] Старт мониторинга. Интервал: {interval_seconds} сек."
        )
        try:
            while True:
                self.collect_once()
                time.sleep(interval_seconds)
        except KeyboardInterrupt:
            print("\nМониторинг принудительно остановлен пользователем.")
