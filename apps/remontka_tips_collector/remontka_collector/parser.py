"""
Модуль для парсинга RSS-ленты и извлечения полезных советов.
"""

import xml.etree.ElementTree as ET
from typing import Any, Dict, List
from bs4 import BeautifulSoup


class RSSParser:
    """Класс для разбора XML RSS-ленты."""

    @staticmethod
    def parse_feed(xml_data: bytes) -> List[Dict[str, str]]:
        """Извлекает список публикаций из сырых данных RSS XML."""
        try:
            root = ET.fromstring(xml_data)
            items = []

            for item in root.findall("./channel/item"):
                title_elem = item.find("title")
                link_elem = item.find("link")
                desc_elem = item.find("description")

                title = (
                    title_elem.text
                    if title_elem is not None and title_elem.text
                    else ""
                )
                link = (
                    link_elem.text
                    if link_elem is not None and link_elem.text
                    else ""
                )
                raw_desc = (
                    desc_elem.text
                    if desc_elem is not None and desc_elem.text
                    else ""
                )

                # Очистка описания от тегов HTML
                clean_desc = (
                    BeautifulSoup(raw_desc, "html.parser").get_text(
                        strip=True
                    )
                    if raw_desc
                    else ""
                )

                if title and link:
                    items.append(
                        {
                            "title": title.strip(),
                            "link": link.strip(),
                            "description": clean_desc,
                        }
                    )
            return items
        except Exception as e:
            print(f"Ошибка при разборе XML RSS: {e}")
            return []
