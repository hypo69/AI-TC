"""
Главная точка входа для запуска сборщика советов.
"""

import argparse
from remontka_collector import TipsCollector
from remontka_collector.config import DEFAULT_INTERVAL_SECONDS, DEFAULT_JSON_FILE, DEFAULT_RSS_URL


def main():
    parser = argparse.ArgumentParser(
        description="Модуль сборщика полезных советов с сайта remontka.pro"
    )
    parser.add_argument(
        "--url",
        default=DEFAULT_RSS_URL,
        help="URL RSS-ленты сайта",
    )
    parser.add_argument(
        "--output",
        "-o",
        default=DEFAULT_JSON_FILE,
        help="Имя файла JSON для сохранения советов",
    )
    parser.add_argument(
        "--interval",
        "-i",
        type=int,
        default=DEFAULT_INTERVAL_SECONDS,
        help="Интервал проверки в секундах (по умолчанию 3600)",
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="Выполнить разовую проверку без периодического повторения",
    )

    args = parser.parse_args()

    collector = TipsCollector(rss_url=args.url, json_file=args.output)

    if args.once:
        print("Выполнение разового сбора советов...")
        collector.collect_once()
    else:
        collector.run_periodic(interval_seconds=args.interval)


if __name__ == "__main__":
    main()
